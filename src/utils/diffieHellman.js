const prime = require("./prime");

const findPandQ = async () => {
	let q = await prime.getPrimeNumber(250);
	let p = 2n * q + 1n;
	while (!prime.isPrime(p)) {
		q = await prime.getPrimeNumber(250);
		p = 2n * q + 1n;
	}
	return {
		p,
		q,
	};
};

const findG = (p, q) => {
	p = BigInt(p);

	let u = prime.randBetween(p);
	let g = prime.modPow(u, p - 1n / q, p);
	if (g == 1) {
		findG(p, q);
	}
	return g;
};

// console.log(
// 	findG(
// 		2892008489112152977727500423395925534448265782469434025702914019945396937427n,
// 		1446004244556076488863750211697962767224132891234717012851457009972698468713n
// 	)
// );

const findP = (q) => {
	q = BigInt(q);
	let p;
	let r = 2n;

	while (true) {
		p = r * q + 1n;
		if (prime.isPrime(p)) {
			return p;
		}
		r++;
	}
};

module.exports = {
	findP,
	findG,
};
