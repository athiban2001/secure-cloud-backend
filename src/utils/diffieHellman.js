const { getPrimeNumber, bitLength } = require("./prime");
const prime = require("./prime");

// const findPandQ = async () => {
// 	let q = await prime.getPrimeNumber(250);
// 	let p = 2n * q + 1n;
// 	while (!prime.isPrime(p)) {
// 		q = await prime.getPrimeNumber(250);
// 		p = 2n * q + 1n;
// 	}
// 	return {
// 		p,
// 		q,
// 	};
// };

const findG = (p, q) => {
	p = BigInt(p);

	let u = prime.randBetween(p);
	let g = prime.modPow(u, p - 1n / q, p);
	if (g == 1) {
		findG(p, q);
	}
	return g;
};

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

const findPandQ = async () => {
	let q = await getPrimeNumber(250);
	q = BigInt(q);
	let p;
	let r = 2n;

	while (true) {
		p = r * q + 1n;
		if (prime.isPrime(p)) {
			if (bitLength(p) < 256) {
				return { p, q };
			} else {
				q = await getPrimeNumber(250);
				r = 1n;
				p = r * q + 1n;
			}
		}
		r++;
	}
};

module.exports = {
	findP,
	findG,
	findPandQ,
};
