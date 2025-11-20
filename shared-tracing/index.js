import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let _sdk;

export default async function initTracing(serviceName = 'unknown-service') {
  if (_sdk) return _sdk;

  const jaegerEndpoint = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [SemanticResourceAttributes.SERVICE_NAME]: serviceName }),
    traceExporter: new JaegerExporter({ endpoint: jaegerEndpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();
  _sdk = sdk;

  process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => {});
  });

  return sdk;
}
