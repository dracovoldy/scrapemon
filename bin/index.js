const puppeteer = require('puppeteer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const cliProgress = require('cli-progress');

async function scrape(start, end, season) {

    // create a new progress bar instance and use shades_classic theme
    const p_bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

    let first_ep = start, last_ep = end;

    if (!start || !end || !season) {
        DEBUG && console.log(`Missing mandatory arguments`);
        throw new Error(`SCRAPE_ARGS_ERROR`)
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
        for (let i = 0; i < msg.args.length; ++i)
            DEBUG && console.log(`${i}: ${msg.args[i]}`);
    });

    await page.goto('https://pokemon360.me/watch-pokemon-episodes-english-dubbed/');

    let list = await page.evaluate(() => {
        let data = []
        /** get list of episodes */
        const list = document.querySelectorAll('#lcp_instance_0 > li');
        for (const a of list) {
            data.push({
                'link': a.querySelector('h4 > a').href,
                'epnum': parseInt(a.querySelector('h4 > a').innerHTML.split(' ')[2])
            })
        }
        return data;
    });

    // let start = 573, end = 625, season = 12;

    list = list.filter(item => {
        if (item.epnum >= start && item.epnum <= end) {
            return true;
        }
        return false;
    });
    list = list.reverse();

    DEBUG && console.log(list);

    console.log(`Scraping data from ep ${start} to ${end}`);

    // progress bar start
    p_bar.start((end - start) + 1, 0);

    // for (let i = start - 1; i < end; i++) {
    //     console.log(list[i])
    // }
    // return;

    for (let i = 0; i < list.length; i++) {

        await page.goto(list[i].link, { waitUntil: "domcontentloaded" });
        await page.waitForSelector('.plyr__video-wrapper');

        let video_data = await page.evaluate(() => {
            /** get video */
            let video_meta = {}
            const video_player = document.querySelector('.plyr__video-wrapper > video');
            video_meta.poster = video_player.poster;
            video_meta.media_url = video_player.src;

            return video_meta;
        });

        list[i].poster = video_data.poster;
        list[i].media_url = video_data.media_url;

        let wiki_data;

        if (list[i].epnum <= 659) {

            await page.goto('https://en.wikipedia.org/wiki/List_of_Pok%C3%A9mon_episodes_(seasons_1%E2%80%9313)', { waitUntil: "domcontentloaded" });

            wiki_data = await page.evaluate((i, season, first_ep) => {

                let wiki_meta = {
                    season: season
                };

                // const wiki_table = document.getElementById('ep' + i).parentNode.parentNode.parentNode;
                // const season_h3 = wiki_table.previousElementSibling.previousElementSibling.previousElementSibling.childNodes[1];
                // const total_ep = document.getElementById('ep' + i).parentNode.parentNode.querySelectorAll(".summary").length
                // const first_ep = parseInt(document.getElementById('ep' + i).parentNode.parentNode.querySelectorAll(".vevent")[0].childNodes[0].innerText);
                const ep_of_season = (i - first_ep) + 1;

                wiki_meta.ep_season = ep_of_season;
                // wiki_meta.season = season_h3.id.split('_')[1].split(':')[0] ? season_h3.id.split('_')[1].split(':')[0] : null;
                wiki_meta.wiki_title = document.querySelector("#ep" + i).parentElement.childNodes[2].childNodes[0].wholeText.split('"')[1];
                return wiki_meta;


            }, list[i].epnum, season, first_ep);

        } else if (list[i].epnum >= 660) {

            await page.goto('https://en.wikipedia.org/wiki/List_of_Pok%C3%A9mon_episodes_(seasons_14%E2%80%93present)', { waitUntil: "domcontentloaded" });

            wiki_data = await page.evaluate((i, season, first_ep) => {

                let wiki_meta = {
                    season: season
                };

                // const wiki_table = document.getElementById('ep' + i).parentNode.parentNode.parentNode;
                // const season_h3 = wiki_table.previousElementSibling.previousElementSibling.previousElementSibling.childNodes[1];
                // const total_ep = document.getElementById('ep' + i).parentNode.parentNode.querySelectorAll(".summary").length
                // const first_ep = parseInt(document.getElementById('ep' + i).parentNode.parentNode.querySelectorAll(".vevent")[0].childNodes[0].innerText);
                const ep_of_season = (i - first_ep) + 1;

                wiki_meta.ep_season = ep_of_season;
                // wiki_meta.season = season_h3.id.split('_')[1].split(':')[0] ? season_h3.id.split('_')[1].split(':')[0] : null;
                wiki_meta.wiki_title = document.querySelector("#ep" + i).parentElement.childNodes[2].childNodes[0].wholeText.split('"')[1];
                return wiki_meta;

            }, list[i].epnum, season, first_ep);
        }

        list[i].season = season;
        list[i].ep_season = wiki_data.ep_season;
        list[i].wiki_title = wiki_data.wiki_title;

        // get imdb data
        await page.goto('https://www.imdb.com/title/tt0168366/episodes?season=' + list[i].season, { waitUntil: "domcontentloaded" });
        await page.waitForSelector('.list_item');

        // Run only if wiki season was found
        let imdb_data = await page.evaluate((list) => {
            let imdb_item = {}
            imdb_item.airdate = document.querySelectorAll(".list_item .airdate")[list.ep_season - 1] ? document.querySelectorAll(".list_item .airdate")[list.ep_season - 1].innerText : null;
            imdb_item.rating = document.querySelectorAll(".list_item .ipl-rating-widget")[list.ep_season - 1] ? document.querySelectorAll(".list_item .ipl-rating-widget")[list.ep_season - 1].innerText.split(" ")[1] : null;
            imdb_item.info = document.querySelectorAll(".list_item .item_description")[list.ep_season - 1] ? document.querySelectorAll(".list_item .item_description")[list.ep_season - 1].innerText : null;
            // imdb_item.tv_code = document.querySelectorAll(".list_item .image")[list.ep_season - 1].innerText.toUpperCase().replace(/\s/g, '').replace(/,/g, '');
            imdb_item.ep_href = document.querySelectorAll(".list_item .image > a")[list.ep_season - 1] ? document.querySelectorAll(".list_item .image > a")[list.ep_season - 1].href : null;
            imdb_item.imdb_img = document.querySelectorAll(".list_item .image > a > div > img")[list.ep_season - 1] ? document.querySelectorAll(".list_item .image > a > div > img")[list.ep_season - 1].src : null;
            imdb_item.title = document.querySelectorAll(".list_item strong")[list.ep_season - 1] ? document.querySelectorAll(".list_item strong")[list.ep_season - 1].innerText : null;

            return imdb_item;
        }, list[i]);

        list[i].imdb_airdate = imdb_data.airdate;
        list[i].imdb_rating = imdb_data.rating;
        list[i].imdb_info = imdb_data.info;
        list[i].tv_code = 'S' + list[i].season + 'E' + list[i].ep_season;
        list[i].ep_href = imdb_data.ep_href;
        list[i].imdb_img = imdb_data.imdb_img;
        list[i].imdb_title = imdb_data.title;

        DEBUG && console.log('\nscraped: ', list[i]);
        DEBUG && console.log('\nfilepath: ', process.cwd());

        fs.readFile(process.cwd() + `/season${season}.json`, function (err, data) {
            var json;
            // console.log('data', typeof (data));

            if (data) {
                json = JSON.parse(data);
                json.push(list[i]);
            } else {
                json = [];
                json.push(list[i]);
            }

            fs.writeFile(process.cwd() + `/season${season}.json`, JSON.stringify(json), (err) => {
                if (err) throw err;
                DEBUG && console.log('\nwrite-complete');

                // update the current value in your application..
                p_bar.update(list[i].ep_season);
            })
        });

    }

    await browser.close();
    // stop the progress bar
    p_bar.stop();
    console.log('Finished! Have Fun! :)');

}

async function init(season) {
    if (!season) {
        throw new Error(`SEASON_NOT_FOUND`);
    }
    const data = await fsPromises.readFile('seasons_list.json', {
        encoding: 'utf8'
    })
        .catch((err) => {
            throw new Error(`SEASON_FILE_ERROR`);
        });

    DEBUG && console.log('seasons file: ', data)

    if (data) {
        list = JSON.parse(data);

        list = list.filter(item => {
            if (item.season == season) {
                return true;
            }
            return false;
        });

        let res = list.pop();
        DEBUG && console.log('args: ', res);

        await scrape(res.start, res.end, season, res.start);
    }
}

module.exports = {
    scrape,
    init
}