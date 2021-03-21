const jwt = require("../utils/jwt");

const jwtAuth = (role) => {
	return (req, res, next) => {
		let token = (req.headers["authorization"] || "").replace("Bearer ", "");
		if (!token) {
			res.status(300).json({ error: "Authorization Required 1" });
			return;
		}
		const { isVerified, payload } = jwt.verifyToken(token);
		if (!isVerified) {
			res.status(300).json({ error: "Authorization Required 2" });
			return;
		}
		if (role !== payload.role) {
			res.status(300).json({ error: "Authorization Required 3" });
			return;
		}

		req.payload = payload;
		next();
	};
};

module.exports = jwtAuth;
