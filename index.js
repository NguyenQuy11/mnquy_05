(function () {
    "use strict";

    var usersKey = "tsqh-shop-users";
    var currentUserKey = "tsqh-shop-current-user";
    var cartKey = "tsqh-shop-cart";
    var adminAccount = {
        username: "admin",
        email: "admin@tsqh.local",
        phone: "0900000000",
        role: "admin",
        password: "Admin@123"
    };

    function users() {
        try {
            var value = JSON.parse(localStorage.getItem(usersKey));
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.warn("Không thể đọc tài khoản đã lưu.", error);
            return [];
        }
    }

    function saveUsers(value) {
        localStorage.setItem(usersKey, JSON.stringify(value));
    }

    async function hash(value) {
        if (!window.crypto || !window.crypto.subtle) {
            var fallback = 2166136261;
            for (var index = 0; index < value.length; index += 1) {
                fallback ^= value.charCodeAt(index);
                fallback = Math.imul(fallback, 16777619);
            }
            return Promise.resolve((fallback >>> 0).toString(16));
        }
        var buffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
        return Array.from(new Uint8Array(buffer)).map(function (byte) {
            return byte.toString(16).padStart(2, "0");
        }).join("");
    }

    async function seedAdmin() {
        var list = users();
        var existingAdmin = list.find(function (user) {
            return user.username === adminAccount.username;
        });
        if (existingAdmin) {
            existingAdmin.role = adminAccount.role;
            existingAdmin.passwordHash = await hash(adminAccount.password);
            saveUsers(list);
        } else {
            list.push({
                id: "admin-demo",
                username: adminAccount.username,
                email: adminAccount.email,
                phone: adminAccount.phone,
                role: adminAccount.role,
                passwordHash: await hash(adminAccount.password),
                orders: []
            });
            saveUsers(list);
        }
    }

    function currentUser() {
        var username = localStorage.getItem(currentUserKey);
        return users().find(function (user) { return user.username === username; }) || null;
    }

    function message(element, text, error) {
        element.textContent = text;
        element.className = "form-message " + (error ? "is-error" : "is-success");
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character];
        });
    }

    function renderAccount(user) {
        document.getElementById("account-panel").hidden = !user;
        document.getElementById("login-form").hidden = Boolean(user);
        document.getElementById("register-form").hidden = Boolean(user);
        if (!user) {
            return;
        }
        document.getElementById("account-username").textContent = user.username;
        document.getElementById("account-email").textContent = user.email;
        document.getElementById("account-phone").textContent = user.phone;
        document.getElementById("account-role").textContent = user.role === "admin" ? "Quản trị viên" : "Khách hàng";
        document.getElementById("account-orders").innerHTML = user.orders.length
            ? user.orders.map(function (order) {
                return "<p>" + escapeHtml(order.id) + " - " + escapeHtml(order.status) + "</p>";
            }).join("")
            : "<p>Chưa có đơn hàng.</p>";
    }

    function renderCart() {
        var cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
        document.getElementById("cart-count").textContent = cart.reduce(function (sum, item) {
            return sum + item.quantity;
        }, 0);
        document.getElementById("cart-items").innerHTML = cart.length
            ? cart.map(function (item) {
                return "<div class=\"cart-item\"><strong>" + escapeHtml(item.name) +
                    "</strong><button type=\"button\" data-remove-cart-item=\"" + escapeHtml(item.id) + "\">Xóa</button></div>";
            }).join("")
            : "<p class=\"cart-empty\">Giỏ hàng đang trống.</p>";
    }

    function goLogin(text) {
        message(document.getElementById("login-message"), text, true);
        window.location.hash = "login";
        document.getElementById("login").scrollIntoView({ behavior: "smooth" });
    }

    function showAccountInfo(card) {
        var panel = document.getElementById("purchase-account");
        var list = card.querySelector("ul");
        document.getElementById("purchase-account-details").innerHTML =
            "<h3>" + escapeHtml(card.querySelector("h3").textContent) + "</h3>" +
            (list ? list.outerHTML : "<p>Shop sẽ xác nhận thông tin chi tiết khi mua.</p>");
        panel.hidden = false;
        document.body.classList.add("cart-is-open");
    }

    function closeAccountInfo() {
        document.getElementById("purchase-account").hidden = true;
        document.body.classList.remove("cart-is-open");
    }

    document.getElementById("login-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        var identifier = document.getElementById("login-username").value.trim().toLowerCase();
        var password = await hash(document.getElementById("login-password").value);
        var user = users().find(function (candidate) {
            return (candidate.username === identifier || candidate.email === identifier) &&
                candidate.passwordHash === password;
        });
        if (!user) {
            message(document.getElementById("login-message"), "Sai tên đăng nhập/email hoặc mật khẩu.", true);
            return;
        }
        localStorage.setItem(currentUserKey, user.username);
        renderAccount(user);
        message(document.getElementById("login-message"), "Đăng nhập thành công.", false);
        this.reset();
    });

    document.getElementById("register-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        var username = document.getElementById("register-username").value.trim().toLowerCase();
        var email = document.getElementById("register-email").value.trim().toLowerCase();
        var phone = document.getElementById("register-phone").value.trim();
        var password = document.getElementById("register-password").value;
        var confirm = document.getElementById("register-confirm-password").value;
        var output = document.getElementById("register-message");
        var list = users();

        if (!/^[a-z0-9_.-]{3,30}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            message(output, "Tên đăng nhập hoặc email không hợp lệ.", true);
            return;
        }
        if (!/^[0-9+()\s.-]{8,20}$/.test(phone) || password.length < 8 || password !== confirm) {
            message(output, "Kiểm tra số điện thoại, mật khẩu tối thiểu 8 ký tự và mật khẩu nhập lại.", true);
            return;
        }
        if (list.some(function (user) { return user.username === username || user.email === email; })) {
            message(output, "Tên đăng nhập hoặc email đã được sử dụng.", true);
            return;
        }

        var user = {
            id: Date.now().toString(),
            username: username,
            email: email,
            phone: phone,
            role: "user",
            passwordHash: await hash(password),
            orders: []
        };
        list.push(user);
        saveUsers(list);
        localStorage.setItem(currentUserKey, user.username);
        renderAccount(user);
        message(output, "Đăng ký thành công.", false);
        this.reset();
    });

    document.getElementById("logout-button").addEventListener("click", function () {
        localStorage.removeItem(currentUserKey);
        renderAccount(null);
    });

    document.addEventListener("click", function (event) {
        var buy = event.target.closest(".btn-buy");
        if (buy) {
            event.preventDefault();
            if (!currentUser()) {
                goLogin("Vui lòng đăng nhập trước khi mua account.");
            } else {
                showAccountInfo(buy.closest(".product-card"));
            }
        }
        if (event.target.closest("#purchase-account-close") || event.target.closest("#purchase-contact")) {
            closeAccountInfo();
        }
        var remove = event.target.closest("[data-remove-cart-item]");
        if (remove) {
            var cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
            localStorage.setItem(cartKey, JSON.stringify(cart.filter(function (item) {
                return item.id !== remove.dataset.removeCartItem;
            })));
            renderCart();
        }
    });

    document.getElementById("product-search").addEventListener("input", function (event) {
        var query = event.target.value.toLowerCase();
        document.querySelectorAll("#products .product-card").forEach(function (card) {
            card.hidden = !card.querySelector("h3").textContent.toLowerCase().includes(query);
        });
    });

    document.getElementById("cart-toggle").addEventListener("click", function () {
        document.getElementById("cart-panel").classList.add("is-open");
    });
    document.getElementById("cart-close").addEventListener("click", function () {
        document.getElementById("cart-panel").classList.remove("is-open");
    });

    seedAdmin().then(function () {
        renderAccount(currentUser());
        renderCart();
    });
}());
