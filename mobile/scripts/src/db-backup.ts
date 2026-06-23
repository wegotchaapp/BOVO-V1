import { spawn } from "node:child_process";
import { Storage } from "@google-cloud/storage";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const BACKUP_PREFIX = "backups/db/";
const DEFAULT_RETENTION_DAYS = 30;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not set`);
  return value;
}

function parsePrivateDir(): { bucketName: string; objectPrefix: string } {
  const dir = requireEnv("PRIVATE_OBJECT_DIR");
  const trimmed = dir.startsWith("/") ? dir.slice(1) : dir;
  const slash = trimmed.indexOf("/");
  if (slash < 0) return { bucketName: trimmed, objectPrefix: "" };
  return {
    bucketName: trimmed.slice(0, slash),
    objectPrefix: trimmed.slice(slash + 1).replace(/\/$/, ""),
  };
}

function getStorageClient(): Storage {
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function runBackup(): Promise<void> {
  const databaseUrl = requireEnv("DATABASE_URL");
  const { bucketName, objectPrefix } = parsePrivateDir();
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);

  const fileName = `bovogo-db-${timestamp()}.sql.gz`;
  const objectPath = [objectPrefix, BACKUP_PREFIX + fileName]
    .filter(Boolean)
    .join("/");

  console.log(`[backup] starting pg_dump → gs://${bucketName}/${objectPath}`);

  const dump = spawn(
    "pg_dump",
    ["--no-owner", "--no-privileges", "--format=plain", databaseUrl],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let stderr = "";
  dump.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const file = bucket.file(objectPath);
  const uploadStream = file.createWriteStream({
    contentType: "application/gzip",
    resumable: false,
    metadata: {
      metadata: {
        createdBy: "scripts/db-backup",
        createdAt: new Date().toISOString(),
      },
    },
  });

  const gzip = createGzip({ level: 6 });

  try {
    await Promise.all([
      pipeline(dump.stdout as Readable, gzip, uploadStream),
      new Promise<void>((resolve, reject) => {
        dump.on("exit", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
        });
        dump.on("error", reject);
      }),
    ]);
  } catch (err) {
    try {
      await file.delete({ ignoreNotFound: true });
    } catch {
      /* swallow */
    }
    throw err;
  }

  const [metadata] = await file.getMetadata();
  const sizeBytes = Number(metadata.size ?? 0);
  console.log(
    `[backup] uploaded ${(sizeBytes / 1024 / 1024).toFixed(2)} MiB to ${objectPath}`,
  );
}

async function rotate(retentionDays: number): Promise<void> {
  const { bucketName, objectPrefix } = parsePrivateDir();
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  const prefix = [objectPrefix, BACKUP_PREFIX].filter(Boolean).join("/");

  const [files] = await bucket.getFiles({ prefix });
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const f of files) {
    const created = f.metadata.timeCreated
      ? new Date(f.metadata.timeCreated).getTime()
      : 0;
    if (created && created < cutoff) {
      await f.delete({ ignoreNotFound: true });
      removed += 1;
    }
  }
  console.log(
    `[backup] rotation: kept ${files.length - removed}, removed ${removed} (retention=${retentionDays}d)`,
  );
}

async function listBackups(): Promise<void> {
  const { bucketName, objectPrefix } = parsePrivateDir();
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  const prefix = [objectPrefix, BACKUP_PREFIX].filter(Boolean).join("/");

  const [files] = await bucket.getFiles({ prefix });
  files.sort((a, b) => {
    const ta = a.metadata.timeCreated
      ? new Date(a.metadata.timeCreated).getTime()
      : 0;
    const tb = b.metadata.timeCreated
      ? new Date(b.metadata.timeCreated).getTime()
      : 0;
    return tb - ta;
  });
  if (files.length === 0) {
    console.log("[backup] no backups found");
    return;
  }
  for (const f of files) {
    const size = Number(f.metadata.size ?? 0);
    const when = f.metadata.timeCreated ?? "?";
    console.log(
      `  ${when}  ${(size / 1024 / 1024).toFixed(2)} MiB  ${f.name}`,
    );
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "run";
  const retention = Number(
    process.env.BACKUP_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS,
  );
  switch (cmd) {
    case "run":
      await runBackup();
      await rotate(retention);
      break;
    case "list":
      await listBackups();
      break;
    case "rotate":
      await rotate(retention);
      break;
    default:
      console.error(`unknown command: ${cmd} (use: run | list | rotate)`);
      process.exit(2);
  }
}

main().catch((err: unknown) => {
  console.error("[backup] failed:", err);
  process.exit(1);
});
