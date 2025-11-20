let requestIdMiddleware = (req, res, next) => {
	const id = req.headers['x-request-id'] || 'test-request-id';
	req.id = id;
	req.log = req.log || { info: () => {}, error: () => {}, child: () => ({ info: () => {} }) };
	res.setHeader && res.setHeader('x-request-id', id);
	next();
};

if (process.env.NODE_ENV !== 'test') {
	(async () => {
		try {
			const mod = await import('../../shared-logging/index.js');
			requestIdMiddleware = mod.requestIdMiddleware || requestIdMiddleware;
		} catch (e) {
			console.error('Could not load shared-logging requestIdMiddleware, using stub', e);
		}
	})();
}

export default requestIdMiddleware;
