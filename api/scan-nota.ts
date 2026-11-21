import type { IncomingMessage, ServerResponse } from 'node:http';
import { processScanNota, type ScanNotaRequestBody } from './_lib/scanNotaCore';

type VercelRequest = IncomingMessage & {
  body?: unknown;
};

function sendJson(res: ServerResponse, statusCode: number, data: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: VercelRequest): Promise<ScanNotaRequestBody | null> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return req.body.trim() ? (JSON.parse(req.body) as ScanNotaRequestBody) : null;
    }
    if (typeof req.body === 'object') {
      return req.body as ScanNotaRequestBody;
    }
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  return JSON.parse(raw) as ScanNotaRequestBody;
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method tidak diizinkan. Gunakan POST.' });
    return;
  }

  let body: ScanNotaRequestBody | null = null;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Format body JSON tidak valid.' });
    return;
  }

  const result = await processScanNota(body);
  sendJson(res, result.status, result.body);
}
