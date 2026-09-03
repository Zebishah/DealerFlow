(() => {
  console.clear();
  console.log(
    "%c[Scraper] AutoPlanet Inventory Scraper v1",
    "color: limegreen; font-weight: bold;"
  );

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // Smooth scroll to trigger lazy images
  const progressiveScroll = async (
    step = window.innerHeight * 0.8,
    pause = 800
  ) => {
    let lastY = 0;
    let currentY = 0;
    let retries = 0;
    const maxRetries = 5;

    while (true) {
      window.scrollBy(0, step);
      await delay(pause);
      currentY = window.scrollY;

      if (currentY + window.innerHeight >= document.body.scrollHeight - 10) {
        retries++;
        if (retries >= maxRetries) break;
      } else {
        retries = 0;
      }
      lastY = currentY;
    }

    console.log("✅ Scrolling complete, returning to top...");
    window.scrollTo(0, 0);
    await delay(1000);
  };

  const scrapeAutoPlanet = async () => {
    const results = [];
    console.log("ℹ️ Waiting for vehicle cards...");

    for (let i = 0; i < 10; i++) {
      const cards = document.querySelectorAll(".vehicle-card");
      if (cards.length > 0) {
        console.log(`✅ Found ${cards.length} cards.`);
        break;
      }
      await delay(1000);
    }

    await progressiveScroll();

    const cards = document.querySelectorAll(".vehicle-card");
    console.log(`📦 Total cards in DOM: ${cards.length}`);

    cards.forEach((card) => {
      const title =
        card.querySelector(".vehicle-card__title")?.innerText.trim() || "";
      const price =
        card
          .querySelector('[convertus-data-id="srp__dealer-price"]')
          ?.innerText.trim() || "";
      const link = card.querySelector("a.vehicle-card__image-link")?.href || "";
      const image = card.querySelector(".vehicle-card__image")?.src || "";
      const stock =
        card
          .querySelector(".vehicle-card__stock")
          ?.innerText.replace("Stock #:", "")
          .trim() || "";
      const location =
        card
          .querySelector(".vehicle-card__location")
          ?.innerText.replace("This vehicle is located in", "")
          .trim() || "";
      const odometer =
        card
          .querySelector('[data-spec="odometer"] .detailed-specs__value')
          ?.innerText.trim() || "";
      const year = card.dataset.vehicleYear || "";
      const make = card.dataset.vehicleMake || "";
      const model = card.dataset.vehicleModel || "";
      const trim = card.dataset.vehicleTrim || "";
      const colour = card.dataset.vehicleColour || "";
      const vin = card.dataset.vehicleVin || "";
      const carfax = card.querySelector(".carfax a p")?.dataset.vin || "";
      const finance =
        card
          .querySelector(".price-block__single--finance .df.aifs")
          ?.innerText.trim() || "";
      const financeTerm =
        card.querySelector(".price-block__sub")?.innerText.trim() || "";

      results.push({
        title,
        year,
        make,
        model,
        trim,
        colour,
        vin,
        stock,
        price,
        finance,
        financeTerm,
        odometer,
        location,
        link,
        image,
        carfax,
      });
    });

    console.table(results);
    console.log(`✅ Scraped ${results.length} vehicles successfully.`);
    return results;
  };

  scrapeAutoPlanet();
})();
