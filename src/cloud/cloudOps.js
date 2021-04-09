const admin = require("firebase-admin");
const { Readable } = require("stream");
const path = require("path");
const { response } = require("express");

const GOOGLE_CREDENTIALS_PATH = path.join(__dirname, "../../credentials.json");

admin.initializeApp({
	credential: admin.credential.cert(GOOGLE_CREDENTIALS_PATH),
	storageBucket: "group-storage-9685d.appspot.com",
});

const bucket = admin.storage().bucket();

function Upload(storageFilename, base64EncodedContent) {
	const buffer = Buffer.from(base64EncodedContent, "base64");
	const file = bucket.file(storageFilename);
	const s = new Readable();
	s.push(buffer);
	s.push(null);
	return s.pipe(file.createWriteStream());
}

async function Download(storageFilename) {
	const file = bucket.file(storageFilename);
	const [data] = await file.download();
	return data.toString("base64");
}

async function Delete(storageFilename) {
	const file = bucket.file(storageFilename);
	const [response] = await file.delete();
	return response;
}

async function DeleteMany(storageFoldername) {
	await bucket.deleteFiles({
		prefix: `${storageFoldername}/`,
	});
}

module.exports = {
	Upload,
	Download,
	Delete,
	DeleteMany,
};
