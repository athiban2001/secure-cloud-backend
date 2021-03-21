const crypto = require("crypto");
const { cpus } = require("os");
const { Worker, parentPort, isMainThread } = require("worker_threads");

//prettier-ignore
const knownPrimes=[
	3n,5n,7n,11n,13n,17n,19n,23n,29n,31n,37n,41n,43n,47n,53n,59n,61n,67n,71n,73n,79n,
    83n,89n,97n,101n,103n,107n,109n,113n,127n,131n,137n,139n,149n,151n,157n,163n,167n,173n,179n,181n,191n,193n,197n,199n,211n,223n,227n,229n,233n,239n,241n,251n,257n,263n,269n,
    271n,277n,281n,283n,293n,307n,311n,313n,317n,331n,337n,347n,349n,353n,359n,367n,373n,379n,383n,389n,397n,401n,
    409n,419n,421n,431n,433n,439n,443n,449n,457n,461n,463n,467n,479n,487n,491n,499n,503n,509n,521n,523n,541n,
    547n,557n,563n,569n,571n,577n,587n,593n,599n,601n,607n,613n,617n,619n,631n,641n,643n,647n,653n,659n,661n,673n,677n,
    683n,691n,701n,709n,719n,727n,733n,739n,743n,751n,757n,761n,769n,773n,787n,797n,809n,811n,821n,823n,827n,829n,
    839n,853n,857n,859n,863n,877n,881n,883n,887n,907n,911n,919n,929n,937n,941n,947n,953n,967n,971n,977n,983n,991n,
    997n,1009n,1013n,1019n,1021n,1031n,1033n,1039n,1049n,1051n,1061n,1063n,1069n,1087n,1091n,1093n,1097n,1103n,
    1109n,1117n,1123n,1129n,1151n,1153n,1163n,1171n,1181n,1187n,1193n,
    1201n,1213n,1217n,1223n,1229n,1231n,1237n,1249n,1259n,1277n,1279n,1283n,1289n,1291n,1297n,1301n,1303n,1307n,1319n,1321n,1327n,1361n,1367n,1373n,1381n,1399n,1409n,1423n,1427n,
	1429n,1433n,1439n,1447n,1451n,1453n,1459n,1471n,1481n,1483n,1487n,1489n,1493n,1499n,1511n,1523n,1531n,1543n,1549n,1553n,1559n,1567n,1571n,1579n,1583n,1597n
];

let useWorkers = true;
if (!isMainThread) {
	parentPort.on("message", function (data) {
		const isPrime = isProbablyPrime(data.rnd, data.iterations);
		parentPort.postMessage({
			isPrime,
			value: data.rnd,
			id: data.id,
		});
	});
}

const isProbablyPrime = (w, iterations = 16) => {
	if (w === 2n) {
		return true;
	} else if ((w & 1n) === 0n || w === 1n) {
		return false;
	}

	for (let i = 0; i < knownPrimes.length && knownPrimes[i] <= w; i++) {
		const p = knownPrimes[i];
		if (w == p) {
			return true;
		} else if (w % p === 0n) {
			return false;
		}
	}

	let a = 0n;
	const d = w - 1n;
	let aux = d;
	while (aux % 2n === 0n) {
		aux /= 2n;
		++a;
	}

	const m = d / 2n ** a;
	do {
		const b = randBetween(d, 2n);
		let z = modPow(b, m, w);
		if (z === 1n || z === d) {
			continue;
		}
		let j = 1;
		while (j < a) {
			z = modPow(z, 2n, w);
			if (z === d) {
				break;
			}
			if (z === 1n) {
				return false;
			}
			j++;
		}
		if (z !== d) {
			return false;
		}
	} while (--iterations);

	return true;
};

const getPrimeNumber = (bitLength, iterations = 16) => {
	if (bitLength < 1) {
		throw new RangeError("bitLength must be > 0");
	}

	if (!useWorkers) {
		let rnd = 0n;
		do {
			rnd = fromBuffer(randBitsSync(bitLength, true));
		} while (!_isProbablyPrime(rnd, iterations));
		return new Promise((resolve) => {
			resolve(rnd);
		});
	}

	return new Promise((resolve) => {
		const workerList = [];
		const onMessage = (msg, newWorker) => {
			if (msg.isPrime) {
				for (let j = 0; j < workerList.length; j++) {
					workerList[j].terminate();
				}
				while (workerList.length) {
					workerList.pop();
				}
				resolve(msg.value);
			} else {
				const buff = randBitsSync(bitLength, true);
				const rnd = fromBuffer(buff);
				try {
					newWorker.postMessage({
						rnd: rnd,
						iterations: iterations,
						id: msg.id,
					});
				} catch (e) {}
			}
		};

		for (let i = 0; i < cpus().length - 1; i++) {
			const newWorker = new Worker(__filename);
			newWorker.on("message", (msg) => onMessage(msg, newWorker));
			workerList.push(newWorker);
		}

		for (let i = 0; i < workerList.length; i++) {
			randBits(bitLength, true).then((buff) => {
				const rnd = fromBuffer(buff);
				workerList[i].postMessage({
					rnd: rnd,
					iterations: iterations,
					id: i,
				});
			});
		}
	});
};

const fromBuffer = (buff) => {
	let number = 0n;
	for (const i of buff.values()) {
		const bigI = BigInt(i);
		number = (number << BigInt(8)) + bigI;
	}

	return number;
};

const randBitsSync = (bitLength, forceLength = false) => {
	const byteLength = Math.ceil(bitLength / 8);
	const rndBytes = randBytesSync(byteLength, false);
	const bitLengthMod8 = bitLength % 8;

	if (bitLengthMod8) {
		rndBytes[0] = rndBytes[0] & (2 ** bitLengthMod8 - 1);
	}
	if (forceLength) {
		const mask = bitLengthMod8 ? 2 ** (bitLengthMod8 - 1) : 128;
		rndBytes[0] = rndBytes[0] | mask;
	}

	return rndBytes;
};

const randBits = (bitLength, forceLength = false) => {
	const byteLength = Math.ceil(bitLength / 8);
	const bitLengthMod8 = bitLength % 8;

	return new Promise((resolve) => {
		randBytes(byteLength, false).then((rndBytes) => {
			if (bitLengthMod8) {
				rndBytes[0] = rndBytes[0] & (2 ** bitLengthMod8 - 1);
			}
			if (forceLength) {
				const mask = bitLengthMod8 ? 2 ** (bitLengthMod8 - 1) : 128;
				rndBytes[0] = rndBytes[0] | mask;
			}
			resolve(rndBytes);
		});
	});
};

const randBytes = (byteLength, forceLength = false) => {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(byteLength, (err, buff) => {
			if (err) {
				reject(err);
			}
			if (forceLength) {
				buf[0] = buf[0] | 128;
			}
			resolve(buff);
		});
	});
};

const randBytesSync = (byteLength, forceLength = false) => {
	const buff = crypto.randomBytes(byteLength);
	if (forceLength) {
		buff[0] = buff[0] | 128;
	}

	return buff;
};

const randBetween = (max, min = 1n) => {
	if (max <= 0n || min < 0n || max <= min) {
		throw new RangeError("max > 0 && min >=0 && max > min");
	}
	const interval = max - min;
	const bitLen = bitLength(interval);
	let rnd;
	do {
		const buff = randBitsSync(bitLen);
		rnd = fromBuffer(buff);
	} while (rnd > interval);

	return rnd + min;
};

const modInv = (a, n) => {
	const egcd = eGcd(toZn(a, n), n);
	if (egcd.g !== 1n) {
		throw new RangeError("No Inverse Modulo");
	} else {
		return toZn(egcd.x, n);
	}
};

const bitLength = (a) => {
	a = BigInt(a);
	if (a === 1n) {
		return 1;
	}
	let bits = 1;
	do {
		bits++;
	} while ((a >>= 1n) > 1n);
	return bits;
};

const abs = (a) => {
	a = BigInt(a);
	return a >= 0n ? a : -a;
};

const eGcd = (a, b) => {
	a = BigInt(a);
	b = BigInt(b);
	if ((a <= 0n) | (b <= 0n)) {
		throw new RangeError("a and b MUST be > 0");
	}

	let x = 0n;
	let y = 1n;
	let u = 1n;
	let v = 0n;

	while (a !== 0n) {
		const q = b / a;
		const r = b % a;
		const m = x - u * q;
		const n = y - v * q;
		b = a;
		a = r;
		x = u;
		y = v;
		u = m;
		v = n;
	}
	return {
		g: b,
		x: x,
		y: y,
	};
};

const toZn = (a, n) => {
	n = BigInt(n);
	if (n <= 0) {
		return NaN;
	}

	a = BigInt(a) % n;
	return a < 0 ? a + n : a;
};

const modPow = (b, e, n) => {
	n = BigInt(n);
	if (n === 0n) {
		throw new RangeError("n must be > 0");
	} else if (n === 1n) {
		return BigInt(0);
	}
	b = toZn(b, n);
	e = BigInt(e);
	if (e < 0n) {
		return modInv(modPow(b, abs(e), n), n);
	}

	let r = 1n;
	while (e > 0) {
		if (e % 2n === 1n) {
			r = (r * b) % n;
		}
		e = e / 2n;
		b = b ** 2n % n;
	}

	return r;
};

function find_xi(p) {
	return new Promise((resolve, reject) => {
		let p1 = p - 1n;
		let xi = randBetween(p1, 1n);
		let gcd = eGcd(xi, p1);
		while (gcd.g !== 1n) {
			xi = randBetween(p1, 1n);
			gcd = eGcd(xi, p1);
		}
		resolve(xi);
	});
}
// let p = 3490214590970643266829347708884132280515133032822901341029123470833482886823n;
// find_xi(p).then((xi) => {
// 	let y = modInv(xi, p - 1n);
// });

let p = 2892008489112152977727500423395925534448265782469434025702914019945396937427n;
let q = 1446004244556076488863750211697962767224132891234717012851457009972698468713n;
let g = 2411791678875673015167120597615695985272696273651930040967888045705490681206n;
// const k = (() => {
// 	let k = randBetween(q);
// 	while (eGcd(k, q).g !== 1n) {
// 		k = randBetween(q);
// 	}
// 	return k;
// })();
let ki = 241909348000483758959863890323939894069476074531443707736885065588472250379n;
let gk = modPow(g, ki, p);
let Xi = 1157075261077181054030007485712556856583731636916774217287642520874318871275n;
let Xik = modPow(Xi, ki, p);
// console.log(Xik);
// console.log(gk);

module.exports = {
	getPrimeNumber,
	isPrime: isProbablyPrime,
	knownPrimes,
	randBetween,
	modPow,
	gcd: eGcd,
};
