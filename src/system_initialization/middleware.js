const jwt = require("../utils/jwt");

const jwtAuth = (role) => {
	return (req, res, next) => {
		let token = (req.headers["authorization"] || "").replace("Bearer ", "");
		if (!token) {
			res.status(300).json({ error: "Authorization Required" });
			return;
		}
		const { isVerified, payload } = jwt.verifyToken(token);
		console.log(isVerified, payload);
		if (!isVerified) {
			res.status(300).json({ error: "Authorization Required" });
			return;
		}
		if (role !== payload.role) {
			res.status(300).json({ error: "Authorization Required" });
			return;
		}

		req.payload = payload;
		next();
	};
};

module.exports = jwtAuth;
