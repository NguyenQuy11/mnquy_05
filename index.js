(function () {
    "use strict";

    var cartKey = "tsqh-shop-cart";
    var userKey = "tsqh-shop-user";
    var cart = loadCart();
    var cartPanel = document.getElementById("cart-panel");
    var cartBackdrop = document.getElementById("cart-backdrop");
    var cartItems = document.getElementById("cart-items");
    var cartCount = document.getElementById("cart-count");
    var cartTotal = document.getElementById("cart-total");

    function loadCart() {
        try {
            var savedCart = JSON.parse(localStorage.getItem(cartKey));
            return Array.isArray(savedCart) ? savedCart : [];
        } catch (error) {
            console.warn("Không thể đọc giỏ hàng đã lưu.", error);
            return [];
        }
    }

    function saveCart() {
        localStorage.setItem(cartKey, JSON.stringify(cart));
    }

    function parsePrice(priceText) {
        var number = Number(String(priceText).replace(/[^\d]/g, ""));
        return Number.isFinite(number) ? number : 0;
    }

    function formatPrice(price) {
        return price.toLocaleString("vi-VN") + "đ";
    }

    function renderCart() {
        var itemCount = cart.reduce(function (total, item) {
            return total + item.quantity;
        }, 0);
        var total = cart.reduce(function (sum, item) {
            return sum + item.price * item.quantity;
        }, 0);

        cartCount.textContent = itemCount;
        cartTotal.textContent = formatPrice(total);

        if (cart.length === 0) {
            cartItems.innerHTML = '<p class="cart-empty">Giỏ hàng đang trống.</p>';
            return;
        }

        cartItems.innerHTML = cart.map(function (item) {
            return '<div class="cart-item">' +
                '<div><strong>' + escapeHtml(item.name) + '</strong>' +
                '<span>' + formatPrice(item.price) + ' x ' + item.quantity + '</span></div>' +
                '<button type="button" class="cart-item__remove" data-remove-cart-item="' + item.id + '">Xóa</button>' +
                "</div>";
        }).join("");
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            var entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };
            return entities[character];
        });
    }

    function openCart() {
        cartPanel.classList.add("is-open");
        cartPanel.setAttribute("aria-hidden", "false");
        cartBackdrop.hidden = false;
        document.body.classList.add("cart-is-open");
    }

    function closeCart() {
        cartPanel.classList.remove("is-open");
        cartPanel.setAttribute("aria-hidden", "true");
        cartBackdrop.hidden = true;
        document.body.classList.remove("cart-is-open");
    }

    function addToCart(button) {
        var card = button.closest(".product-card");
        var nameElement = card && card.querySelector("h3");
        var priceElement = card && card.querySelector("strong");

        if (!card || !nameElement) {
            return;
        }

        var item = {
            id: nameElement.textContent.trim().toLowerCase(),
            name: nameElement.textContent.trim(),
            price: parsePrice(priceElement ? priceElement.textContent : "0"),
            quantity: 1
        };
        var existingItem = cart.find(function (cartItem) {
            return cartItem.id === item.id;
        });

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push(item);
        }

        saveCart();
        renderCart();
        openCart();
    }

    document.getElementById("cart-toggle").addEventListener("click", openCart);
    document.getElementById("cart-close").addEventListener("click", closeCart);
    cartBackdrop.addEventListener("click", closeCart);

    document.addEventListener("click", function (event) {
        var removeButton = event.target.closest("[data-remove-cart-item]");
        if (removeButton) {
            cart = cart.filter(function (item) {
                return item.id !== removeButton.dataset.removeCartItem;
            });
            saveCart();
            renderCart();
            return;
        }

        var buyButton = event.target.closest(".acc-list .btn-buy");
        if (buyButton) {
            event.preventDefault();
            addToCart(buyButton);
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeCart();
        }
    });

    document.getElementById("cart-checkout").addEventListener("click", function () {
        closeCart();
        window.location.hash = "contact";
    });

    document.getElementById("product-search").addEventListener("input", function (event) {
        var query = event.target.value.trim().toLowerCase();
        var cards = document.querySelectorAll("#products .product-card");
        var visibleCards = 0;

        cards.forEach(function (card) {
            var name = card.querySelector("h3").textContent.toLowerCase();
            var isVisible = name.includes(query);
            card.hidden = !isVisible;
            if (isVisible) {
                visibleCards += 1;
            }
        });

        var emptyMessage = document.getElementById("product-search-empty");
        if (!emptyMessage) {
            emptyMessage = document.createElement("p");
            emptyMessage.id = "product-search-empty";
            emptyMessage.className = "search-empty";
            document.querySelector("#products .product-grid").after(emptyMessage);
        }
        emptyMessage.textContent = visibleCards === 0 ? "Không tìm thấy sản phẩm phù hợp." : "";
        emptyMessage.hidden = visibleCards !== 0;
    });

    document.getElementById("login-form").addEventListener("submit", function (event) {
        event.preventDefault();
        var username = document.getElementById("login-username").value.trim();
        var password = document.getElementById("login-password").value;
        var message = document.getElementById("login-message");

        if (username.length < 3 || password.length < 6) {
            message.textContent = "Tên đăng nhập cần ít nhất 3 ký tự và mật khẩu ít nhất 6 ký tự.";
            message.className = "form-message is-error";
            return;
        }

        localStorage.setItem(userKey, username);
        message.textContent = "Đăng nhập demo thành công với tài khoản " + username + ".";
        message.className = "form-message is-success";
        this.reset();
    });

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
            var target = document.querySelector(link.getAttribute("href"));
            if (!target || target.classList.contains("acc-list")) {
                return;
            }

            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            history.replaceState(null, "", link.getAttribute("href"));
        });
    });

    renderCart();
}());
