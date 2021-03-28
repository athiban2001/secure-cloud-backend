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
	const {
		response,
		error,
	} = await db.query("SELECT id,name,p,q,g FROM groups WHERE id=$1", [
		groupId,
	]);
	if (error) {
		res.status(500).json({ error: "Group Fetching Unsuccessful" });
		return;
	}
	res.status(200).json({ ...response.rows[0] });
});

managerRouter.get("/requests", jwtAuth("MANAGER"), async (req, res) => {
	const groupId = req.payload.groupId;
	const {
		response,
		error,
	} = await db.query(
		"SELECT r.id,r.user_id,r.group_id,r.xi,r.joining,r.ok,(SELECT name FROM users WHERE id=r.user_id) as user_name,(SELECT email FROM users WHERE id=r.user_id) as email,(SELECT name FROM groups WHERE id=r.group_id) AS group_name FROM requests r WHERE r.group_id=$1 AND r.ok IS NULL",
		[groupId]
	);
	if (error) {
		console.log(error);
		res.status(500).json({ error: "Requests Fetching Unsuccessful" });
		return;
	}
	res.status(200).json({
		length: response.rowCount,
		requests: response.rows,
	});
});

/**
 * Body Format
 * [{
 * 	"userId":1,
 * 	"Xik":"123123",
 * 	"time":"toJSON Date"
 * },{
 * 	"userId":2,
 * 	"Xik":"123231",
 * 	"time":"toJSON Date"
 * }]
 */
managerRouter.post("/requests", jwtAuth("MANAGER"), async (req, res) => {
	const memberList = req.body;
	const payload = [];
	const payload2 = [];
	let queryString = `INSERT INTO members(group_id,user_id,join_time,"Xik") VALUES`;
	let queryString2 = `UPDATE requests SET ok=true WHERE user_id IN (`;
	let i = 1;
	let j = 1;
	try {
		memberList.forEach((member, index) => {
			queryString += `($${i++},$${i++},$${i++},$${i++})`;
			queryString2 += `$${j++}`;
			if (index < memberList.length - 1) {
				queryString += ",";
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
		res.status(300).send({ error: "Invalid Body Data" });
		return;
	}
	console.log(queryString2, payload2);

	const client = await db.pool.connect();
	let response;

	try {
		await client.query("BEGIN");
		response = await client.query(queryString, payload);
		response = await client.query(queryString2, payload2);
		await client.query("COMMIT");
	} catch (err) {
		await client.query("ROLLBACK");
		console.log(err);
		res.status(500).json({ error: "Internal Server Error" });
		return;
	} finally {
		client.release();
	}

	res.status(200).json({ membersAdded: response.rowCount });
});

/**
 * Body Format
 *
 * [reqid1,reqid2,...]
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

module.exports = managerRouter;
