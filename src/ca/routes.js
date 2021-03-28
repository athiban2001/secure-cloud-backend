const express = require("express");
const jwt = require("../utils/jwt");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const privateKey = fs.readFileSync(
	path.join(__dirname, "./keys/privateKey.pem"),
	"utf-8"
);
const publicKey = fs.readFileSync(
	path.join(__dirname, "./keys/publicKey.pem"),
	"utf-8"
);

const caRouter = express.Router();

caRouter.post("/sign", async (req, res) => {
	const token = req.body.token;
	const publicKey = req.body.publicKey;
	if (!token || !publicKey) {
		res.status(300).json({ error: "Invalid Body Data" });
		return;
	}
	const { isVerified, payload } = jwt.verifyToken(token);
	if (!isVerified) {
		res.status(300).json({ error: "Please Login First" });
		return;
	}

	crypto.sign("rsa", publicKey, "").toString("base64");
});

module.exports = caRouter;
