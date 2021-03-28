const { Pool } = require("pg");

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl:
		process.env.NODE_ENV === "development"
			? undefined
			: {
					rejectUnauthorized: false,
			  },
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
	pool,
};
