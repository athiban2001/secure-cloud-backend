const express = require("express");
const cors = require("cors");
const adminRouter = require("./system_initialization/routes");
// const userRouter = require("./user/routes");
// const managerRouter = require("./manager/routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/admin", adminRouter);
// app.use("/api/user", userRouter);
// app.use("/api/manager", managerRouter);

app.listen(process.env.PORT, () => {
	console.log("Server is running on http://localhost:" + process.env.PORT);
});
