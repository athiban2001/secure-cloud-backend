const jwt = require("jsonwebtoken");

const signToken = (payload) => {
	const token = jwt.sign(payload, process.env.JWT_SECRET);

	return token;
};

const verifyToken = (token) => {
	let isVerified = false;
	let payload;
	try {
		payload = jwt.verify(token, process.env.JWT_SECRET);
		isVerified = true;
	} catch (err) {
		isVerified = false;
		payload = {};
	}

	return {
		isVerified,
		payload,
	};
};

module.exports = {
	signToken,
	verifyToken,
};
