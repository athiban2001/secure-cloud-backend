const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const jwt = require("../utils/jwt");
const jwtAuth = require("../system_initialization/middleware");

const managerRouter = express.Router();

managerRouter.post("/login", async (req, res) => {
	const email = req.body.email;
	const password = req.body.password;
	if (!email || !password) {
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}
	const {
		response,
		err,
	} = await db.query(
		"SELECT m.id,g.id as group_id,m.name,m.email,m.password FROM groups g,managers m WHERE g.group_manager_id=m.id AND m.email=$1",
		[email]
	);
	if (err) {
		res.status(300).json({ error: "Login Unsuccessful" });
		return;
	}

	if (response.rowCount != 1) {
		res.status(300).json({ error: "Login Unsuccessful" });
		return;
	}

	const passwordCheck = await bcrypt.compare(
		password,
		response.rows[0].password
	);
	if (!passwordCheck) {
		res.status(300).json({ error: "Login Unsuccessful" });
		return;
	}

	const token = jwt.signToken({
		role: "MANAGER",
		id: response.rows[0].id,
		name: response.rows[0].name,
		email: response.rows[0].email,
		groupId: response.rows[0].group_id,
	});

	res.status(200).json({ token });
});

managerRouter.get("/group", jwtAuth("MANAGER"), async (req, res) => {
	const groupId = req.payload.groupId;
	const { response, err } = await db.query(
		`
		SELECT id,name,p,q,g,(
			SELECT array_to_json(array_agg(row_to_json(data))) as members FROM 
			(SELECT DISTINCT ON (m.user_id) u.name,u.email,m.* FROM members m,users u WHERE group_id=$1 AND u.id=m.user_id ORDER BY m.user_id ASC,m.join_time ASC) data
		) FROM groups WHERE id=$1
	`,
		[groupId]
	);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "Group Fetching Unsuccessful" });
		return;
	}
	res.status(200).json({ ...response.rows[0] });
});

managerRouter.get("/requests", jwtAuth("MANAGER"), async (req, res) => {
	const groupId = req.payload.groupId;
	const {
		response,
		err,
	} = await db.query(
		"SELECT r.id,r.user_id,r.group_id,r.xi,r.joining,r.ok,(SELECT name FROM users WHERE id=r.user_id) as user_name,(SELECT email FROM users WHERE id=r.user_id) as email,(SELECT name FROM groups WHERE id=r.group_id) AS group_name FROM requests r WHERE r.group_id=$1 AND r.ok IS NULL",
		[groupId]
	);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "Requests Fetching Unsuccessful" });
		return;
	}
	res.status(200).json({
		length: response.rowCount,
		requests: response.rows,
	});
});

managerRouter.get("/Xi", jwtAuth("MANAGER"), async (req, res) => {
	const queryString = `
	SELECT * FROM requests
	WHERE ok=true AND joining=true AND group_id=$1
	`;
	const { response, err } = await db.query(queryString, [
		req.payload.groupId,
	]);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "Internal Server Error" });
		return;
	}

	res.status(200).json({ requests: response.rows });
});

/**
 * Body Format
 * membersData : [{
 * 	"userId":1,
 * 	"Xik":"123123",
 * 	"time":"toJSON Date"
 * },{
 * 	"userId":2,
 * 	"Xik":"123231",
 * 	"time":"toJSON Date"
 * }]
 * newUsersLength:1
 */
managerRouter.post("/requests", jwtAuth("MANAGER"), async (req, res) => {
	const memberList = req.body.membersData;
	const newUsersLength = req.body.newUsersLength;

	if (!memberList || !newUsersLength || !memberList.length) {
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}

	const payload = [];
	const payload2 = [req.payload.groupId];
	let queryString3 = `INSERT INTO members(group_id,user_id,join_time,"Xik") VALUES`;
	let queryString2 = `UPDATE requests SET ok=true WHERE group_id=$1 AND joining=true AND user_id IN (`;
	let queryString = `SELECT COUNT(DISTINCT user_id) AS old_members FROM members WHERE group_id=$1`;
	let i = 1;
	let j = 2;
	try {
		memberList.forEach((member, index) => {
			queryString3 += `($${i++},$${i++},$${i++},$${i++})`;
			queryString2 += `$${j++}`;
			if (index < memberList.length - 1) {
				queryString3 += ",";
				queryString2 += ",";
			} else {
				queryString2 += ")";
			}

			if (!member.userId || !member.time || !member.Xik) {
				res.status(300).json({ error: "Invalid Body Data" });
				return;
			}

			payload.push(
				req.payload.groupId,
				member.userId,
				new Date(member.time),
				member.Xik
			);
			payload2.push(member.userId);
		});
	} catch (e) {
		console.log(e);
		res.status(300).send({ error: "Invalid Body Data" });
		return;
	}

	const { response: resp, err } = await db.query(queryString, [
		req.payload.groupId,
	]);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "Internal Server Error" });
		return;
	}
	if (memberList.length - newUsersLength != resp.rows[0].old_members) {
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}

	const client = await db.pool.connect();

	try {
		await client.query("BEGIN");
		await client.query(queryString3, payload);
		await client.query(queryString2, payload2);
		await client.query("COMMIT");
	} catch (err) {
		await client.query("ROLLBACK");
		console.log(err);
		res.status(500).json({ error: "Internal Server Error" });
		return;
	} finally {
		client.release();
	}

	res.status(200).json({ membersAdded: newUsersLength });
});

/**
 * Body Format
 *
 * [reqid1,reqid2,...]
 *
 */
managerRouter.put("/requests", jwtAuth("MANAGER"), async (req, res) => {
	let queryString = "UPDATE requests SET ok=false WHERE id IN (";
	const reqIds = req.body || [];
	let i = 1;
	console.log(reqIds);
	if (reqIds.length == 0) {
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}
	reqIds.forEach((_, index) => {
		queryString += `$${i++}`;
		if (index < reqIds.length - 1) {
			queryString += `,`;
		} else {
			queryString += `)`;
		}
	});
	const { response, err } = await db.query(queryString, reqIds);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "Internal Server Error" });
		return;
	}

	res.status(200).json({ requestsRejected: response.rowCount });
});

/* Body Format
 * membersData:[{
 * 	"userId":1,
 * 	"Xik":"123123",
 * 	"time":"toJSON Date"
 * },{
 * 	"userId":2,
 * 	"Xik":"123231",
 * 	"time":"toJSON Date"
 * }]
 * removeUsersIDs:[1,2,...]
 */
managerRouter.patch("/requests", jwtAuth("MANAGER"), async (req, res) => {
	const membersList = req.body.membersData;
	const removeUsersIDs = req.body.removeUsersIDs;

	if (
		!Array.isArray(membersList) ||
		!removeUsersIDs ||
		!removeUsersIDs.length
	) {
		console.log(membersList, removeUsersIDs);
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}
	const removeUsersLength = req.body.removeUsersIDs.length;
	let queryString = `SELECT COUNT(DISTINCT user_id) AS old_members  FROM members WHERE group_id=$1`;
	const { response: resp, err } = await db.query(queryString, [
		req.payload.groupId,
	]);

	if (err) {
		console.log(err);
		res.status(500).json({ error: "Internal Server Error 1" });
		return;
	}
	if (membersList.length + removeUsersLength != resp.rows[0].old_members) {
		console.log(
			typeof membersList.length,
			typeof removeUsersLength,
			typeof resp.rows[0].old_members
		);
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}

	queryString = `INSERT INTO members(group_id,user_id,join_time,"Xik") VALUES`;
	const payload = [];
	let queryString2 = "DELETE FROM members WHERE group_id=$1 AND user_id IN (";
	const payload2 = [req.payload.groupId];
	let queryString3 =
		"DELETE FROM requests WHERE group_id=$1 AND user_id IN (";
	const payload3 = [req.payload.groupId];

	let i = 1;
	let j = 2;

	membersList.forEach((member, index) => {
		queryString += `($${i++},$${i++},$${i++},$${i++})`;
		if (index < membersList.length - 1) {
			queryString += ",";
		}
		payload.push(
			req.payload.groupId,
			member.userId,
			new Date(member.time),
			member.Xik
		);
	});

	removeUsersIDs.forEach((userId, index) => {
		queryString2 += `$${j}`;
		queryString3 += `$${j}`;
		if (index < removeUsersIDs.length - 1) {
			queryString2 += ",";
			queryString3 += ",";
		} else {
			queryString2 += ")";
			queryString3 += ")";
		}
		j++;
		payload2.push(userId);
		payload3.push(userId);
	});

	const client = await db.pool.connect();
	console.log(payload, payload2, payload3);
	try {
		await client.query("BEGIN");
		await client.query(queryString2, payload2);
		await client.query(queryString3, payload3);
		if (membersList.length) {
			await client.query(queryString, payload);
		}
		await client.query("COMMIT");
	} catch (e) {
		await client.query("ROLLBACK");
		res.status(400).json({ error: "Internal Server Error 2" });
		return;
	} finally {
		client.release();
	}

	res.status(200).json({ usersRemoved: removeUsersLength });
});

module.exports = managerRouter;
