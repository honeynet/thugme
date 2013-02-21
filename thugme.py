from wsgiref.simple_server import make_server

import bottle
from bottle import Bottle, static_file, request, redirect
from jinja2 import Environment, FileSystemLoader
from recaptcha.client import captcha

bottle.debug(True)
app = Bottle()
template_env = Environment(loader=FileSystemLoader("./templates"))


@app.route('/static/<filepath:path>')
def server_static(filepath):
    return static_file(filepath, root='./static')


@app.route('/favicon.ico')
def favicon():
    return static_file('/favicon.ico', root='./static')


@app.route('/')
def thugme():
    template = template_env.get_template('index.html')
    return template.render()

@app.post('/api/search')
def search():
    return { "request": request.forms.get('url'),
             "results": (({"timestamp":123},{"timestamp":456}) if request.forms.get('url') != "no" else [])
        }

@app.post('/api/analyze')
def analyze():
    response = captcha.submit(
        request.forms.get('recaptcha_challenge_field'),
        request.forms.get('recaptcha_response_field'),
        "FIXME: private key",
        request.environ.get('REMOTE_ADDR')
        )
    if not response.is_valid:
        return {"success": False}
    else:
        return {"success": True} #return some id, too.

if __name__ == "__main__":
    httpd = make_server('', 8000, app)
    print "Serving on port 8000..."
    httpd.serve_forever()
