
const https = require("https");

function githubRequest(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method: options.method || "GET",
        headers: {
          "User-Agent": "Hex-Gallery",
          "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json"
        }
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          let parsed;

          try {
            parsed = JSON.parse(data);
          } catch {
            return reject(new Error("Respons GitHub tidak valid."));
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(parsed.message || "GitHub API error.")
            );
          }

          resolve(parsed);
        });
      }
    );

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

function send(res, status, data) {
  return res.status(status).json(data);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return send(res, 405, {
      success: false,
      error: "Method tidak diizinkan."
    });
  }

  try {
    const { image, caption } = req.body || {};

    if (!process.env.GITHUB_TOKEN) {
      return send(res, 500, {
        success: false,
        error: "GITHUB_TOKEN belum diset."
      });
    }

    if (
      typeof image !== "string" ||
      typeof caption !== "string" ||
      !image.trim() ||
      !caption.trim()
    ) {
      return send(res, 400, {
        success: false,
        error: "Link dan caption wajib diisi."
      });
    }

    let imageUrl;

    try {
      imageUrl = new URL(image.trim());

      if (!["http:", "https:"].includes(imageUrl.protocol)) {
        throw new Error("URL tidak valid.");
      }
    } catch {
      return send(res, 400, {
        success: false,
        error: "Link gambar tidak valid."
      });
    }

    if (caption.trim().length > 1000) {
      return send(res, 400, {
        success: false,
        error: "Caption maksimal 1000 karakter."
      });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const filePath = "data.json";

    if (!owner || !repo) {
      return send(res, 500, {
        success: false,
        error: "Konfigurasi GitHub belum lengkap."
      });
    }

    const apiPath =
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
      `/contents/${filePath}?ref=${encodeURIComponent(branch)}`;

    const file = await githubRequest(apiPath);

    if (Array.isArray(file)) {
      throw new Error("Path data.json bukan file.");
    }

    const currentContent = Buffer.from(
      file.content || "",
      "base64"
    ).toString("utf8");

    let data;

    try {
      data = JSON.parse(currentContent || "[]");
    } catch {
      throw new Error("Isi data.json tidak valid.");
    }

    if (!Array.isArray(data)) {
      throw new Error("data.json harus berupa array.");
    }

    data.push({
      image: imageUrl.toString(),
      caption: caption.trim()
    });

    const updatedContent = JSON.stringify(data, null, 2);

    const commitPath =
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
      `/contents/${filePath}`;

    const result = await githubRequest(
      commitPath,
      { method: "PUT" },
      {
        message: "feat: tambah foto baru",
        content: Buffer.from(updatedContent).toString("base64"),
        branch,
        sha: file.sha
      }
    );

    return send(res, 200, {
      success: true,
      message: "Foto berhasil ditambahkan ke GitHub.",
      commit: result.commit?.html_url || null
    });
  } catch (error) {
    console.error(error);

    return send(res, 500, {
      success: false,
      error: error.message || "Terjadi kesalahan server."
    });
  }
};
