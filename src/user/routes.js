const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const jwt = require("../utils/jwt");
const jwtAuth = require("../system_initialization/middleware");
const memberAuth = require("./middleware");

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
		console.log(err);
		res.status(500).json({ error: "Registration unsuccessful" });
		return;
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
	const { response, err } = await db.query(
		`SELECT g.id,g.name,m.name as manager_name,g.p,g.g,g.q,
		(SELECT COUNT(id)>0 FROM requests WHERE group_id=g.id AND user_id=$1 AND joining=true) as joining_requested,
		(SELECT COUNT(id)>0 FROM requests WHERE group_id=g.id AND user_id=$1 AND joining=false) as leaving_requested,
		(SELECT ok FROM requests WHERE group_id=g.id AND user_id=$1 AND joining=true) as is_joining_accepted,
		(SELECT ok FROM requests WHERE group_id=g.id AND user_id=$1 AND joining=false) as is_leaving_accepted
		FROM groups g,managers m WHERE m.id=g.group_manager_id`,
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
		groups: rows,
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
		"SELECT r.id,r.user_id,(SELECT name FROM groups WHERE id=r.group_id) as group_name,(SELECT name FROM managers WHERE id=(SELECT group_manager_id FROM groups WHERE id=r.group_id)) as manager_name,r.ok,r.joining FROM requests r WHERE r.user_id=$1",
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

userRouter.delete(
	"/:group_id/resign",
	jwtAuth("USER"),
	memberAuth,
	async (req, res) => {
		const group_id = req.params.group_id;
		let {
			response,
			err,
		} = await db.query(
			"SELECT COUNT(id) FROM requests WHERE user_id=$1 AND group_id=$2",
			[req.payload.id, group_id]
		);
		if (err) {
			console.log(err);
			res.status(500).json({ error: "Internal Server Error" });
			return;
		}
		if (response.rowCount != 1) {
			res.status(200).json({ done: true });
			return;
		}

		let {
			response: resp,
			err: error,
		} = await db.query(
			"INSERT INTO requests(user_id,group_id,ok,joining) VALUES($1,$2,NULL,$3) RETURNING id",
			[req.payload.id, group_id, false]
		);
		if (error) {
			console.log(error);
			res.status(500).json({ error: "Internal Server Error" });
			return;
		}

		res.status(200).json({ id: resp.rows[0].id });
	}
);

userRouter.delete("/requests", jwtAuth("USER"), async (req, res) => {
	const {
		response,
		err,
	} = await db.query("DELETE FROM requests WHERE ok=false AND user_id=$1", [
		req.payload.id,
	]);
	if (err) {
		console.log(err);
		res.status(500).json({ error: "Internal Server Error" });
		return;
	}

	console.log(response);
	res.status(200).json({ data: response.rows[0] });
});

module.exports = userRouter;
