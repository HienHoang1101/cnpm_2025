let logger = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {},
	child: function () { return this; }
};

export const pinoHttp = (req, res, next) => next();
export const requestIdMiddleware = (req, res, next) => {
	const id = req.headers['x-request-id'] || 'test-request-id';
	req.id = id;
	req.log = logger;
	res.setHeader && res.setHeader('x-request-id', id);
	next();
};

if (process.env.NODE_ENV !== 'test') {
	(async () => {
		try {
			const mod = await import('../../shared-logging/index.js');
			logger = mod.default || mod.logger || logger;
			// re-exporting not possible dynamically — but requests will use req.log from middleware
		} catch (e) {
			// keep stub
			console.error('Could not load shared-logging, using stub logger', e);
		}
	})();
}

export default logger;
