const fs = require("fs");
const path = require("path");
const express = require("express");
const nanoid = require("nanoid").nanoid;
const jwtAuth = require("../system_initialization/middleware");
const memberAuth = require("../user/middleware");
const db = require("../db");
const { Upload, Delete, Download } = require("../cloud/cloudOps");

const fileRouter = express.Router();

fileRouter.post(
	"/:group_id/upload/init",
	jwtAuth("USER"),
	memberAuth,
	async (req, res) => {
		const client = await db.pool.connect();
		const returnData = {};
		let response;
		if (!req.body.original_filename || !req.body.file_size) {
			res.status(300).json({ error: "Invalid Body Data" });
			return;
		}

		try {
			await client.query("BEGIN");
			response = await client.query(
				`SELECT COUNT(id) AS name_count FROM files WHERE
				group_id=$2 
				AND POSITION($1 in SPLIT_PART(original_filename,'.',1))>0
				AND CHAR_LENGTH(SPLIT_PART(original_filename,'.',1))-CHAR_LENGTH($1) BETWEEN 0 AND 3;`,
				[req.body.original_filename.split(".")[0], req.params.group_id]
			);
			returnData.storage_filename = `${nanoid()}`;
			if (req.body.original_filename.includes(".tar.gz")) {
				returnData.storage_filename += ".tar.gz.enc";
			} else {
				returnData.storage_filename += ".gz.enc";
			}

			if (response.rows[0].name_count == 0) {
				returnData.original_filename = req.body.original_filename;
			} else if (req.body.original_filename.includes(".tar.gz")) {
				returnData.original_filename = req.body.original_filename.replace(
					".tar.gz",
					`(${response.rows[0].name_count}).tar.gz`
				);
			}
			response = await client.query(
				`INSERT INTO files(group_id,user_id,original_filename,storage_filename,file_time,file_size,is_uploaded) 
				VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
				[
					req.params.group_id,
					req.payload.id,
					returnData.original_filename,
					returnData.storage_filename,
					new Date(),
					req.body.file_size,
					false,
				]
			);
			returnData.file_id = response.rows[0].id;
			response = await client.query(
				`
			SELECT id,join_time,"Xik" FROM members 
			WHERE user_id=$1 AND group_id=$2
			ORDER BY join_time DESC LIMIT 1;`,
				[req.payload.id, req.params.group_id]
			);
			returnData.Xik = response.rows[0].Xik;
			await client.query("COMMIT");
		} catch (e) {
			console.log(e);
			await client.query("ROLLBACK");
			res.status(500).json({ error: "Internal Server Error" });
			return;
		} finally {
			client.release();
		}
		res.status(200).json({ ...returnData });
	}
);

fileRouter.post(
	"/:group_id/upload",
	jwtAuth("USER"),
	memberAuth,
	async (req, res) => {
		if (!req.body.id || !req.body.content || !req.body.original_filename) {
			res.status(300).json({ error: "Invalid Body Data" });
			return;
		}
		const client = await db.pool.connect();
		let response;
		try {
			await client.query("BEGIN");
			response = await client.query(
				"SELECT * FROM files WHERE id=$1 AND user_id=$2 AND group_id=$3 AND is_uploaded=false",
				[req.body.id, req.payload.id, req.params.group_id]
			);
			if (response.rowCount != 1) {
				res.status(300).json({ error: "Invalid File ID" });
				return;
			}
			Upload(
				`${response.rows[0].group_id}/${response.rows[0].storage_filename}`,
				req.body.content
			)
				.on("error", (err) => {
					throw err;
				})
				.on("finish", async () => {
					res.status(200).json({ done: true });
				});
			await client.query(
				"UPDATE files SET is_uploaded=true WHERE id=$1 AND user_id=$2 AND group_id=$3",
				[req.body.id, req.payload.id, req.params.group_id]
			);
			await client.query("COMMIT");
		} catch (e) {
			console.log(e);
			await client.query("ROLLBACK");
			res.status(500).json({ error: "Internal Server Error" });
			return;
		} finally {
			client.release();
		}
	}
);

fileRouter.get(
	"/:group_id/files",
	jwtAuth("USER"),
	memberAuth,
	async (req, res) => {
		const { response, err } = await db.query(
			`
	SELECT id,file_time,original_filename,file_size FROM files WHERE group_id=$1 AND is_uploaded=true
	AND file_time>(SELECT join_time FROM members WHERE user_id=$2 AND group_id=$1 ORDER BY join_time ASC LIMIT 1)`,
			[req.params.group_id, req.payload.id]
		);
		if (err) {
			console.log(err);
			res.status(500).json({ error: "Internal Server Error" });
			return;
		}
		res.status(200).json({ files: response.rows });
	}
);

fileRouter.get(
	"/:group_id/files/:id",
	jwtAuth("USER"),
	memberAuth,
	async (req, res) => {
		let response,
			returnData = {};
		const client = await db.pool.connect();
		try {
			response = await client.query(
				`SELECT * FROM files 
				WHERE id=$1 AND group_id=$2 
				AND is_uploaded=true
				AND file_time>(SELECT join_time FROM members WHERE user_id=1 AND group_id=1 ORDER BY join_time ASC LIMIT 1)`,
				[req.params.id, req.params.group_id]
			);
			if (response.rowCount != 1) {
				throw new Error("No File is Found");
			}
			returnData.id = response.rows[0].id;
			returnData.original_filename = response.rows[0].original_filename;
			returnData.storage_filename = response.rows[0].storage_filename;
			returnData.file_time = response.rows[0].file_time;
			response = await client.query(
				`
			SELECT "Xik" FROM members 
			WHERE user_id=$1 AND group_id=$2 
			AND join_time<(SELECT file_time FROM files WHERE id=$3) 
			ORDER BY join_time DESC LIMIT 1`,
				[req.payload.id, req.params.group_id, req.params.id]
			);
			returnData.Xik = response.rows[0].Xik;
		} catch (e) {
			console.log(e);
			res.status(500).json({ error: "Internal Server Error" });
			return;
		} finally {
			client.release();
		}
		returnData.content = await Download(
			`${req.params.group_id}/${returnData.storage_filename}`
		);

		res.status(200).json({ ...returnData });
	}
);

module.exports = fileRouter;
