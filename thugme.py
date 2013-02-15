from wsgiref.simple_server import make_server

import bottle
from bottle import Bottle, static_file, request, redirect
from jinja2 import Environment, FileSystemLoader


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

if __name__ == "__main__":
    httpd = make_server('', 8000, app)
    print "Serving on port 8000..."
    httpd.serve_forever()
