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
	console.log(req);

	if (!managerName || !email || !password || !groupName) {
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}

	const q = await prime.getPrimeNumber(250);
	const p = dh.findP(q);
	const g = dh.findG(p, q);
	const hashedPassword = await bcrypt.hash(password, 8);

	const {
		response,
		err,
	} = await db.query(
		"INSERT INTO managers(name,email,password) VALUES($1,$2,$3) RETURNING *",
		[managerName, email, hashedPassword]
	);
	if (err) {
		res.status(500).json({ error: "Group Creation unsuccessful" });
		return;
	}

	const { rows } = response;
	const {
		response: resp,
		err: e,
	} = await db.query(
		"INSERT INTO groups(name,p,q,g,group_manager_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
		[groupName, p, q, g, rows[0].id]
	);

	if (e) {
		res.status(500).json({ error: "Group Creation unsuccessful" });
		return;
	}

	res.status(201).json({ ...resp.rows[0] });
});

adminRouter.get("/groups", jwtAuth("ADMIN"), async (req, res) => {
	const { response, err } = await db.query(
		"SELECT g.id,g.name,m.name as manager_name,m.email FROM groups g,managers m WHERE g.group_manager_id=m.id OFFSET 0 LIMIT 100"
	);
	if (err) {
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

	const {
		response,
		err,
	} = await db.query(
		"SELECT g.id,g.name,m.name as manager_name,m.email FROM groups g,managers m WHERE g.group_manager_id=m.id AND g.id=$1 OFFSET 0 LIMIT 100",
		[id]
	);
	if (err) {
		res.status(500).json({ error: "No Group is Found" });
		return;
	}
	const { rowCount, rows } = response;
	if (rowCount != 1) {
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

	const {
		response,
		err,
	} = await db.query(
		"DELETE FROM groups WHERE id=$1 RETURNING group_manager_id",
		[id]
	);
	if (err || response.rowCount != 1) {
		res.status(500).json({ error: "Unable to delete Group " + id });
		return;
	}
	const { err: e } = await db.query("DELETE FROM managers WHERE id=$1", [
		response.rows[0].group_manager_id,
	]);
	if (e) {
		res.status(500).json({
			error:
				"Unable to delete Group Manager " +
				response.rows[0].group_manager_id,
		});
		return;
	}

	res.status(200).json({ id });
});

module.exports = adminRouter;
