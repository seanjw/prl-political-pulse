---
title: Americas Pulse Public Data Dashboards
---

# Basic Commands

- `site/serve`: serve the site locally for development
- `site/push`: push site to s3; changes will be public

Builds:

- `site/src/build`: update the landing page
- `site/src/citizens`: update the citizens pages
- `site/src/elites`: update the elite pages

# About

## Auto Updates

The lab's primary cron file runs the following commands:

- `site/src/update` <-- updates the landing page
- `site/src/citizens/update` <-- updates the citizen content (survey data)
- `site/src/elites/update` <-- updates the elite content (legislators data)
- `site/push` <-- pushes the static content to s3 (where it's hosted for public access at [americaspoliticalpulse.com](americaspoliticalpulse.com)`)

## Server

The `pulse/server/` code runs on lambda; (use `server/api/run.py` to run the local server for testing).

The api setup is very simple. The primary api code is in `server/api/main.py`. One api endpoint `pull_data` let's the frontend specify a particular row in the `data` table, and pull json content from it. That means if we want to add a chunk of json to be accessed by a front end page, we dont have to mess with the api code at all, and can just add a row with a unique endpoint value + some json data, and the api will feed it to the front end.

There's another endpoint called "query", which is a little tricker. It allows the front end to specify specific types of queries with filter operations, like less then, equal to, etc. The options available to the front end _have_ to be specified in as parameters in the python script. So, if you want to add new filter operations or new tables for the front end to access, you have to modify this part:

```python3 server/api/main.py
# -- Query --
fields = {
    'state',
    'party',
    'level',
    'bioguide_id',
    'name',
    'type',
    'source_id',
}

ops = {
    'eq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'icontains',
}

tables = {
    'legislators': Legislators,
    'federal_profiles': FederalProfiles,
    'state_profiles': StateProfiles,
}

...
```
^ the reason we hand specify is to avoid accidentally giving the front end access to data it shouldn't have access to. So, the safeguard is: force the developer to explicitly add access.

But overall it's pretty simple and flexible, and we'll never need to add any more endpoints to our api. (we could even further reduce the whole thing into a single /query/ endpoint, but that just feels like unnecessary code-golfing).

### how to deploy on lambda:

- make a lambda function on aws
    - make a lambda layer for the python depenencies
        - `py39 -m pip install -r requirements -t python/` <-- saves all the modules to python/
        - `zip -r python.zip python/` <-- and upload that to the labmda layer
    - upload `api/` to main lambda func
        - `cd api/`
        - `zip -r api.zip ./` <-- upload that to function
- make an aws api gateway resource to attach to lambda 
    - add a proxy path {proxy+} for integration (method type ANY)
- set the url for the front end fetches (setting in /src/\_data/config.json - `backend_url`) to the correct path of the resource (make sure to include the /stage/ in the url; like 'https:dsjkafl;jda;sl/stage/then-your-path-here'; e.g.: https://fajdsklfdjs/default/apipath)

## Site

- liquid tags: {{ }}, {% %} are for server side rendering
- (modified) nunjuck tags: [[ ]], [% %] are for client side rendering

The `site/serve` command runs a locally hosted front end server for debugging / development.

### Dependencies

- [alpine.js](https://alpinejs.dev/) (used heavily; combines with a custom directive that lets you trigger a template render via html attribute `x-fetch-then-template="<< request endpoint >>"`)
- [uikit.js](https://getuikit.com/) (css framework)
- [nunjucks](https://mozilla.github.io/nunjucks/)
- python (for building / curating datasets), w: 
    - [dataset](https://dataset.readthedocs.io/en/latest/)
    - [ibis](https://ibis-project.org/)

### Organization

The site repo structure is designed to be as modular as possible, with as few dependencies between modules as possible. There are a few globally required data files in `site/src/_data/`, but aside from those, most of the data / python scripts to generate the data are stored in the modules themselves. 

In particular, most modules that require data from the lab's database will have a `build.py` file, which pulls and analyzes data from lab's core database collections and routes it into the `pulse` database collection (which should be assumed to be public facing).

---

# What would be cool in the future

- [ ] ideology progress bar on the profile thumb card
- [ ] wrap all charts in a class that will have padding and download buttons
- [ ] scroll-to-section on citizen and international; so you can link / refresh to specific section via url params

---

# Notes

https://twitter.com/intent/user?user_id=123456789 <-- use that to get twitter profile
- find your representative options for state stuff
- search filter scheme on api call: `{ field: 'state', op: 'eq', value: 'New York' }]`

## What we lost in v2:

- [ ] probublica calculated ideology data for "votes with party" / "votes against party"

