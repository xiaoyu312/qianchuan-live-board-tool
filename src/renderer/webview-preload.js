function openHere(url) {
  if (/^https?:\/\//.test(String(url || ""))) window.location.href = url;
}

window.open = (url) => {
  openHere(url);
  return null;
};

document.addEventListener(
  "click",
  (event) => {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link || link.target !== "_blank") return;
    event.preventDefault();
    openHere(link.href);
  },
  true
);
