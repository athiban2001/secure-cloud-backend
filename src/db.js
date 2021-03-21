const { Pool } = require("pg");

const pool = new Pool({
	user: process.env.DB_USERNAME,
	password: process.env.DB_PASSWORD,
	host: process.env.DB_HOST,
	port: 5432,
	database: process.env.DB_NAME,
});

const query = async (queryString, parameters) => {
	let err = null;
	let response = null;

	try {
		const client = await pool.connect();
		response = await client.query(queryString, parameters);
		client.release();
	} catch (e) {
		err = e;
	}

	return {
		err,
		response,
	};
};

module.exports = {
	query,
};
