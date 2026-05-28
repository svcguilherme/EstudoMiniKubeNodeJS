'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'api-person',
  traceExporter: new OTLPTraceExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318'}/v1/traces`,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } }),
  ],
});

try { sdk.start(); console.log('OpenTelemetry tracing initialized'); }
catch (err) { console.warn('OTel init skipped:', err.message); }

process.on('SIGTERM', () => sdk.shutdown().catch(() => {}));
