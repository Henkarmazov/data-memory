
const form = document.getElementById("galleryForm");
const submitBtn = document.getElementById("submitBtn");
const statusText = document.getElementById("status");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const image = document.getElementById("image").value.trim();
  const caption = document.getElementById("caption").value.trim();

  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";
  statusText.textContent = "";
  statusText.className = "";

  try {
    const response = await fetch("/api/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image,
        caption
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Gagal menyimpan foto.");
    }

    statusText.textContent = "Foto berhasil disimpan ke GitHub.";
    statusText.className = "success";

    form.reset();
  } catch (error) {
    statusText.textContent = error.message;
    statusText.className = "error";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan Foto";
  }
});
