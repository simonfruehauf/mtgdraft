
const SCRYFALL_API_BASE = 'https://api.scryfall.com';

async function checkAltArts(setCode: string) {
    console.log(`Checking set: ${setCode}`);
    const allCards: any[] = [];
    // Check specific showcase cards
    let url: string | null = `${SCRYFALL_API_BASE}/cards/search?q=e:${setCode}+frame:showcase&unique=prints`;
    const showcaseCards: any[] = [];

    while (url) {
        const response = await fetch(url);
        const json = await response.json();
        if (json.data) showcaseCards.push(...json.data);
        url = json.has_more ? json.next_page : null;
    }

    const report = [
        `--- Showcase Cards Analysis ---`,
        `Total Showcase Found: ${showcaseCards.length}`,
        `Sample Showcase Card Booster Status:`,
        ...showcaseCards.slice(0, 10).map(c => `${c.name} (${c.collector_number}): booster=${c.booster}`)
    ].join('\n');

    const fs = await import('fs');
    fs.writeFileSync('alt_arts_report.txt', report);
    console.log('Report written to alt_arts_report.txt');
}

checkAltArts('mkm'); // Check a recent set known for alt arts
