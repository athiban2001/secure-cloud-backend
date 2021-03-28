const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const jwt = require("../utils/jwt");
const jwtAuth = require("../system_initialization/middleware");

const userRouter = express.Router();

userRouter.post("/register", async (req, res) => {
	const username = req.body.username;
	const email = req.body.email;
	const password = req.body.password;
	if (!username || !password || !email) {
		console.log(username, email, password);
		res.status(400).json({ error: "Invalid Body Data" });
		return;
	}
	const hashedPassword = await bcrypt.hash(password, 8);
	const {
		response,
		err,
	} = await db.query(
		"INSERT INTO users(name,email,password)VALUES($1,$2,$3) RETURNING *",
		[username, email, hashedPassword]
	);
	if (err) {
		res.status(500).json({ error: "Registration unsuccessful" });
	}
	const { rows, rowCount } = response;
	if (rowCount != 1) {
		res.status(500).json({ error: "Registration unsuccessful" });
		return;
	}
	const token = jwt.signToken({
		role: "USER",
		id: rows[0].id,
		name: rows[0].name,
		email: rows[0].email,
	});
	res.status(201).json({
		...rows[0],
		token,
	});
});

userRouter.post("/login", async (req, res) => {
	const email = req.body.email;
	const password = req.body.password;
	if (!email || !password) {
		res.status(400).json({ error: "Invalid Body Data" });
		return;
	}
	const {
		response,
		err,
	} = await db.query("SELECT * FROM users WHERE email=$1", [email]);
	if (err) {
		res.status(500).json({ error: "Login unsuccessful" });
	}
	const { rowCount, rows } = response;
	if (rowCount != 1) {
		res.status(400).json({ error: "User not found" });
		return;
	}
	const passwordCheck = await bcrypt.compare(password, rows[0].password);
	if (!passwordCheck) {
		res.status(400).json({ error: "User not found" });
		return;
	}
	const token = jwt.signToken({
		role: "USER",
		id: rows[0].id,
		name: rows[0].name,
		email: rows[0].email,
	});
	res.status(200).json({ token });
});

userRouter.get("/groups", jwtAuth("USER"), async (req, res) => {
	const {
		response,
		err,
	} = await db.query(
		"SELECT g.id,g.name,m.name as manager_name,g.p,g.g,g.q,(SELECT r.id FROM requests r WHERE r.group_id=g.id AND r.user_id=$1) AS is_requested,(SELECT r.ok FROM requests r WHERE r.group_id=g.id AND r.user_id=$1) AS is_accepted FROM groups g,managers m WHERE g.group_manager_id=m.id OFFSET 0 LIMIT 100",
		[req.payload.id]
	);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "Group Fetching Failed" });
		return;
	}
	const { rowCount, rows } = response;
	res.status(200).send({
		length: rowCount,
		groups: rows.map((row) => ({
			...row,
			is_requested: row.is_requested != null,
			is_accepted: row.is_accepted == true,
		})),
	});
});

userRouter.post("/requests", jwtAuth("USER"), async (req, res) => {
	const groupId = req.body.groupId;
	const Xi = req.body.Xi;
	const joining = req.body.joining;

	console.log(req.body);
	if (!groupId || !Xi) {
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}

	const {
		response,
		err,
	} = await db.query(
		"INSERT INTO requests(user_id,group_id,xi,ok,joining) VALUES($1,$2,$3,NULL,$4) RETURNING *",
		[req.payload.id, groupId, Xi, joining]
	);
	if (err || response.rowCount != 1) {
		res.status(500).json({ error: "Request Not Submitted" });
		return;
	}
	res.status(200).json(response.rows[0]);
});

userRouter.get("/requests", jwtAuth("USER"), async (req, res) => {
	const {
		response,
		err,
	} = await db.query(
		"SELECT r.id,r.user_id,g.name as group_name,m.name as manager_name,r.ok FROM requests r,groups g,managers m WHERE r.user_id=$1",
		[req.payload.id]
	);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "Requests Fetching Failed" });
		return;
	}
	res.status(200).json({
		length: response.rowCount,
		requests: response.rows,
	});
});

module.exports = userRouter;
