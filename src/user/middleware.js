const db = require("../db");

const memberAuth = async (req, res, next) => {
	const groupId = req.params.group_id;
	const {
		response,
		err,
	} = await db.query(
		"SELECT COUNT(m.id)>0 AS entry FROM members m WHERE m.user_id=$1 AND m.group_id=$2",
		[req.payload.id, groupId]
	);
	if (err) {
		console.log(err);
		res.status(300).json({ error: "Internal Server Error" });
		return;
	}

	if (response.rows[0].entry) {
		next();
	} else {
		res.status(300).json({ error: "Invalid Group ID" });
		return;
	}
};

module.exports = memberAuth;
