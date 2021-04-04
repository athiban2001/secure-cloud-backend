const express = require("express");
const bcrypt = require("bcryptjs");
const prime = require("../utils/prime");
const dh = require("../utils/diffieHellman");
const jwt = require("../utils/jwt");
const db = require("../db");
const jwtAuth = require("./middleware");

const adminRouter = express.Router();

adminRouter.post("/login", (req, res) => {
	const username = req.body.username;
	const password = req.body.password;
	if (!username || !password) {
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}
	if (
		username != process.env.ADMIN_USERNAME ||
		password != process.env.ADMIN_PASSWORD
	) {
		res.status(400).json({ error: "Login Unsucessful" });
		return;
	}
	const token = jwt.signToken({
		role: "ADMIN",
		id: 1,
		name: username,
		email: "admin@admin.com",
	});
	res.status(200).json({ token });
});

adminRouter.post("/groups", jwtAuth("ADMIN"), async (req, res) => {
	const managerName = req.body.managerName;
	const email = req.body.email;
	const password = req.body.password;
	const groupName = req.body.groupName;

	if (!managerName || !email || !password || !groupName) {
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}

	const { p, q } = await dh.findPandQ();
	const g = dh.findG(p, q);
	const hashedPassword = await bcrypt.hash(password, 8);

	const client = await db.pool.connect();
	let response;
	try {
		await client.query("BEGIN");
		response = await client.query(
			"INSERT INTO managers(name,email,password) VALUES($1,$2,$3) RETURNING *",
			[managerName, email, hashedPassword]
		);
		const { rows } = response;
		console.log(rows[0].id);
		response = await client.query(
			"INSERT INTO groups(name,p,q,g,group_manager_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
			[groupName, p, q, g, rows[0].id]
		);
		await client.query("COMMIT");
	} catch (e) {
		console.log(e);
		await client.query("ROLLBACK");
		res.status(500).json({ error: "Group Creation unsuccessful" });
		return;
	} finally {
		client.release();
	}

	res.status(201).json({ ...response.rows[0] });
});

adminRouter.get("/groups", jwtAuth("ADMIN"), async (req, res) => {
	const { response, err } = await db.query(
		"SELECT g.id,g.name,m.name as manager_name,m.email FROM groups g,managers m WHERE g.group_manager_id=m.id OFFSET 0 LIMIT 100"
	);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "Groups Fetching Unsucessful" });
		return;
	}

	const { rows, rowCount } = response;
	res.status(200).json({
		length: rowCount,
		groups: rows,
	});
});

adminRouter.get("/groups/:id", jwtAuth("ADMIN"), async (req, res) => {
	const id = req.params.id;
	if (!id) {
		res.status(300).json({ error: "ID Required" });
		return;
	}

	const { response, err } = await db.query(
		`
		SELECT g.id,g.name,m.name as manager_name,m.email,(
			SELECT array_to_json(array_agg(row_to_json(data))) as members FROM 
			(SELECT DISTINCT ON (mm.user_id) u.name,u.email,mm.* 
			FROM members mm,users u WHERE mm.group_id=$1 AND mm.user_id=u.id ORDER BY mm.user_id ASC,mm.join_time ASC LIMIT 1) data
		)
		FROM groups g,managers m 
		WHERE g.group_manager_id=m.id AND g.id=$1 OFFSET 0 LIMIT 100
		`,
		[id]
	);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "No Group is Found" });
		return;
	}
	const { rowCount, rows } = response;
	if (rowCount != 1) {
		console.log(rows);
		res.status(404).json({ error: "No Group is Found" });
		return;
	}

	res.status(200).json({ ...rows[0] });
});

adminRouter.delete("/groups/:id", async (req, res) => {
	const id = req.params.id;
	if (!id) {
		res.status(300).json({ error: "ID is Required" });
		return;
	}

	const client = await db.pool.connect();
	let response;

	try {
		await client.query("BEGIN");
		response = await client.query(
			"DELETE FROM requests WHERE group_id=$1",
			[id]
		);
		response = await client.query("DELETE FROM members WHERE group_id=$1", [
			id,
		]);
		response = await client.query(
			"DELETE FROM groups WHERE id=$1 RETURNING group_manager_id",
			[id]
		);
		let { rows } = response;
		response = await client.query("DELETE FROM managers WHERE id=$1", [
			rows[0].group_manager_id,
		]);
		await client.query("COMMIT");
	} catch (e) {
		console.log(e);
		await client.query("ROLLBACK");
		res.status(500).json({ error: "Unable to delete Group " + id });
		return;
	}

	res.status(200).json({ id });
});

module.exports = adminRouter;
