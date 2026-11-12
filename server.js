const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const sessions = new Map();
const allowedOrigins = new Set(["http://127.0.0.1:5500", "http://localhost:5500"]);

function ensureDataFile() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
    }
}

function readDatabase() {
    ensureDataFile();
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeDatabase(database) {
    ensureDataFile();
    fs.writeFileSync(USERS_FILE, JSON.stringify(database, null, 2));
}

function sendJson(response, statusCode, payload) {
    const origin = allowedOrigins.has(response.req.headers.origin)
        ? response.req.headers.origin
        : "http://127.0.0.1:5500";
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });
    response.end(JSON.stringify(payload));
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 10000) {
                reject(new Error("Request body quá lớn."));
                request.destroy();
            }
        });
        request.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error("Dữ liệu JSON không hợp lệ."));
            }
        });
        request.on("error", reject);
    });
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    const [salt, expectedHash] = storedHash.split(":");
    const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(
        Buffer.from(actualHash, "hex"),
        Buffer.from(expectedHash, "hex")
    );
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        orders: user.orders
    };
}

function validateRegistration(data) {
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(data.username || "")) {
        return "Tên đăng nhập phải dài 3-30 ký tự và chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) {
        return "Email không hợp lệ.";
    }
    if (!/^[0-9+()\s.-]{8,20}$/.test(data.phone || "")) {
        return "Số điện thoại không hợp lệ.";
    }
    if (typeof data.password !== "string" || data.password.length < 8) {
        return "Mật khẩu phải có ít nhất 8 ký tự.";
    }
    return null;
}

function getAuthenticatedUser(request, database) {
    const authorization = request.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const userId = sessions.get(token);
    return userId ? database.users.find((user) => user.id === userId) : null;
}

async function handleRequest(request, response) {
    if (request.method === "OPTIONS") {
        sendJson(response, 204, {});
        return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);
    const database = readDatabase();

    if (request.method === "POST" && url.pathname === "/api/auth/register") {
        const data = await readBody(request);
        const validationError = validateRegistration(data);
        if (validationError) {
            sendJson(response, 400, { message: validationError });
            return;
        }

        const username = data.username.toLowerCase();
        const email = data.email.toLowerCase();
        if (database.users.some((user) => user.username === username || user.email === email)) {
            sendJson(response, 409, { message: "Tên đăng nhập hoặc email đã được sử dụng." });
            return;
        }

        const user = {
            id: crypto.randomUUID(),
            username,
            email,
            phone: data.phone.trim(),
            passwordHash: hashPassword(data.password),
            orders: [],
            createdAt: new Date().toISOString()
        };
        database.users.push(user);
        writeDatabase(database);
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, user.id);
        sendJson(response, 201, { token, user: publicUser(user) });
        return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
        const data = await readBody(request);
        const identifier = String(data.identifier || "").toLowerCase().trim();
        const user = database.users.find(
            (candidate) => candidate.username === identifier || candidate.email === identifier
        );
        if (!user || typeof data.password !== "string" || !verifyPassword(data.password, user.passwordHash)) {
            sendJson(response, 401, { message: "Tên đăng nhập/email hoặc mật khẩu không đúng." });
            return;
        }

        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, user.id);
        sendJson(response, 200, { token, user: publicUser(user) });
        return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth/me") {
        const user = getAuthenticatedUser(request, database);
        if (!user) {
            sendJson(response, 401, { message: "Phiên đăng nhập đã hết hạn." });
            return;
        }
        sendJson(response, 200, { user: publicUser(user) });
        return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
        const token = (request.headers.authorization || "").replace(/^Bearer /, "");
        sessions.delete(token);
        sendJson(response, 200, { message: "Đã đăng xuất." });
        return;
    }

    sendJson(response, 404, { message: "Không tìm thấy API." });
}

ensureDataFile();
http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
        console.error(error);
        sendJson(response, 500, { message: "Lỗi máy chủ. Vui lòng thử lại sau." });
    });
}).listen(PORT, () => {
    console.log(`TSQH API đang chạy tại http://localhost:${PORT}`);
});
