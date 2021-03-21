const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const env = require("dotenv");

env.config({
	path: path.join(__dirname, "../../.env"),
});

crypto.generateKeyPair(
	"rsa",
	{
		modulusLength: 2048,
		publicKeyEncoding: {
			type: "spki",
			format: "pem",
		},
		privateKeyEncoding: {
			type: "pkcs8",
			format: "pem",
			cipher: "aes-256-cbc",
			passphrase: process.env.SIGN_SECRET,
		},
	},
	(err, publicKey, privateKey) => {
		if (err) {
			console.log(err);
			return;
		}
		fs.writeFile(
			path.join(__dirname, "../ca/keys/privateKey.pem"),
			privateKey,
			{ encoding: "utf-8" },
			(err) => {
				console.log(err);
			}
		);
		fs.writeFile(
			path.join(__dirname, "../ca/keys/publicKey.pem"),
			publicKey,
			{ encoding: "utf-8" },
			(err) => {
				console.log(err);
			}
		);
	}
);
