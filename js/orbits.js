
function distance(p1, p2) {
    let dx = p1.x - p2.x;
    let dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function angle(p1, p2) {
    let dx = p2.x - p1.x;
    let dy = -(p2.y - p1.y);
    let alpha = Math.atan2(dy, dx);
    if (alpha < 0) alpha = 2 * Math.PI + alpha;
    return alpha;
}

function Vector(p1, p2) {
    this.mag = distance(p1, p2);
    this.angle = angle(p1, p2);
    this.origin = {
        x: p1.x,
        y: p1.y
    },
        this.dest = {
            x: p2.x,
            y: p2.y
        }
}

class Slider {
    constructor(id, _settings) {
        let settings = _settings || {};
        this.min = settings.min || 0;
        this.max = settings.max || 100;
        this.value = settings.value || 0;
        this.className = settings.className || 'slider';
        this.handlers = {};
        this.container = $(`<div class = 'slider-container'>`);
        this.slider = $(`<input type = range min = "${this.min}" max = "${this.max}" value = "${this.value}" class = "${this.className}">`);
        this.sliderText = $(`<div class = "${this.className}-value">`);
        this.container.append(this.slider, this.sliderText);
        $(`#${id}`).append(this.container);
        this.slider.on('input', this.onInput.bind(this));
        this.setValue(this.value)
    }

    on(event, cb) {
        this.handlers[event] = cb;
    }

    off(event) {
        delete this.handlers[event];
    }

    setValue(v) {
        this.value = v;
        this.valuePercent = this.value / this.max;
    }

    get valueText() {
        return this.sliderText.text();
    }

    set valueText(value) {
        this.sliderText.text(value);
        let sliderPos = this.value / this.max;
        let pixelPosition = this.slider.width() * sliderPos;
        let pos = pixelPosition - (this.sliderText.width() / 2);
        this.sliderText.css('left', pos)
    }

    onInput(ev) {
        this.setValue(ev.target.value);
        if (this.handlers['input']) this.handlers['input'](ev);
    }
}
class System {
    constructor(_opts) {
        let opts = _opts || {}
        this.canvas = opts.canvas;
        this.pathCanvas = opts.pathCanvas;
        this.ctx = this.canvas.getContext('2d');
        this.pathCtx = this.pathCanvas.getContext('2d');
        this.planets = opts.planets || [];
        this.showTrails = opts.showTrails;
        this.G = opts.G || .3
        this.swallows = [];
        this.frame = 0;
        this.collisions = 0;
        this.fastest = 0;
        this.farthest = 0;
        this.timeScale = opts.timeScale || 1;
        this.scale = opts.scale || 1;
        this.bounds = this.getBounds();
    }

    set showTrails (checked) {
        this._showTrails = checked;
        if (checked) {
            $(this.pathCanvas).show();
        } else {
            $(this.pathCanvas).hide();
        }
    }

    get showTrails () {
        return this._showTrails
    }

    getBounds() {
        return {
            x: {
                min: 0,
                max: $('#content').width(),
                center: $('#content').width() / 2
            },
            y: {
                min: 0,
                max: $('#content').height(),
                center: $('#content').height() / 2
            }

        }
    }

    add(planet) {
        this.planets.push(planet);
    }

    fromScaled(point) {
        let x = point.x - this.bounds.x.center;
        let y = point.y - this.bounds.y.center;
        x = x / this.scale;
        y = y / this.scale;
        x += this.bounds.x.center;
        y += this.bounds.y.center;
        return {
            x: x,
            y: y
        }
    }
    toScaled(point) {
        let x = point.x - this.bounds.x.center;
        let y = point.y - this.bounds.y.center;
        x = x * this.scale;
        y = y * this.scale;
        x += this.bounds.x.center;
        y += this.bounds.y.center;
        return {
            x: x,
            y: y
        }
    }


    run() {
        this.startTime = Date.now();

        setTimeout(render.bind(this), 1000 / 25);

        function render() {
            let timestamp = Date.now();
            this.fastest = 0;
            this.farthest = {
                mag: 0
            };

            this.planets.forEach((subject, i) => {
                if (subject.isActive) {
                    subject.force = { x: 0, y: 0 }
                    this.addForces(subject, i, this.collide.bind(this));
                }
            });

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.planets.forEach(planet => {
                if (planet.isActive) planet.move();
                planet.draw();
                if (planet.speed > this.fastest) this.fastest = planet.speed;
            });

            this.frame++
            this.data = {
                frames: this.frame,
                fps: (1 / (timestamp - this.lastTimestamp) * 1000).toFixed(0),
                planets: this.planets.length - 1,
                collisions: this.collisions,
                fastest: this.fastest.toFixed(3),
                farthest: this.farthest
            }
            $('#data').text(JSON.stringify(this.data, null, 2));
            this.lastTimestamp = timestamp;
            setTimeout(render.bind(this), 0);
        }
    }

    addForces(subject, i, onCollision) {
        this.planets.forEach((object, j) => {
            if (subject != object && object.isActive) {
                let vector = new Vector(object, subject);
                if (vector.mag > this.farthest.mag) {
                    this.farthest = vector
                }
                let minDistance = (object.radius + subject.radius);
                if (vector.mag > minDistance) {
                    let fMag = this.G * (subject.mass * object.mass) / (vector.mag * vector.mag);
                    subject.force.x += -fMag * Math.cos(vector.angle);
                    subject.force.y += fMag * Math.sin(vector.angle);
                } else {
                    onCollision(i, j, vector);
                }
            }
        });
    }

    collide(i, j, vector) {
        this.collisions++;
        let subject = this.planets[i];
        let object = this.planets[j];
        if (subject.mass > object.mass) {
            subject.swallow(object);
            this.planets.splice(j, 1);
        } else {
            object.swallow(subject);
            this.planets.splice(i, 1);
        }
    }
}

class Planet {
    constructor(_opts) {
        let opts = _opts || {};
        this.system = opts.system;
        this.v = opts.v || {
            x: 0,
            y: 0
        }

        this.name = opts.name | `p${this.system.planets.length}`,
            this.isMoveable = opts.isMoveable;
        this.mass = opts.mass;
        this.type = opts.type;
        let center = this.system.fromScaled({
            x: opts.x,
            y: opts.y
        });
        this.x = center.x;
        this.y = center.y;
        this.force = {
            x: 0,
            y: 0
        }
        this.isActive = _opts.isActive;
        this.positions = [];
        // this.div = $(`<div class = "planet ${this.type ? this.type : ''}">`);
        // $('#content').append(this.div);
        this.draw()

    }

    swallow(planet, vector) {
        let m = {
            x: (this.mass * this.v.x) + (planet.mass * planet.v.x),
            y: (this.mass * this.v.y) + (planet.mass * planet.v.y)
        }
        this.mass += planet.mass;

        let v = {
            x: m.x / this.mass,
            y: m.y / this.mass
        }
        this.v = v;
        this.draw();
        planet.remove();
    }

    remove() {
        let center = this.system.toScaled({
            x: this.x,
            y: this.y
        })
        this.system.ctx.fillStyle = '#000000';
        this.system.ctx.beginPath();
        this.system.ctx.arc(center.x, center.y, this.radius + 1, 0, 2 * Math.PI);
        this.system.ctx.fill();
    }

    move() {
        //this.remove();
        if (this.isMoveable) {
            let a = {
                x: this.force.x / this.mass,
                y: this.force.y / this.mass
            }

            this.v = {
                x: this.v.x + a.x*this.system.timeScale,
                y: this.v.y + a.y*this.system.timeScale
            }
            this.x = this.x + (this.v.x * this.system.timeScale)/2;
            this.y = this.y + (this.v.y * this.system.timeScale)/2;
        }
    }

    get speed () {
        return Math.sqrt(Math.pow(this.v.x, 2)*Math.pow(this.v.y,2));

    }
    draw() {
        let center = this.system.toScaled({
            x: this.x,
            y: this.y
        })

        this.system.ctx.fillStyle = '#ffffff';
        this.system.ctx.beginPath();
        this.system.ctx.arc(center.x, center.y, this.scaledRadius, 0, 2 * Math.PI);
        this.system.ctx.fill();

        this.system.pathCtx.fillStyle = '#666666';
        this.system.pathCtx.beginPath();
        this.system.pathCtx.arc(center.x, center.y, 1, 0, 2 * Math.PI);
        this.system.pathCtx.fill();
    }

    get mass() {
        return this._mass
    }
    set mass(m) {
        this._mass = m;
        this.radius = Math.pow(this.mass, 1 / 3);
    }

    get scaledRadius() {
        return Math.max(.5, Math.round(this.radius * this.system.scale));

    }
}


$(document).ready(function () {



    function fillRandomPlanets(ev) {
        ev.stopPropagation();
        let vMax = 5;
        for (let p = 1; p < 1000; p++) {
            system.add(new Planet({
                system: system,
                type: 'water',
                isMoveable: true,
                isActive: true,
                mass: Math.random() * 0 + 1,
                v: {
                    x: Math.random() * 2 * vMax - vMax,
                    y: Math.random() * 2 * vMax - vMax
                },
                x: Math.random() * $('#content').width(),
                y: Math.random() * $('#content').height()
            }));
        }
    }

    let content = $('#content');
    let canvas = $('<canvas>');
    let pathCanvas = $('<canvas>');
    content.append(canvas);
    content.append(pathCanvas);
    let width = content.width();
    let height = content.height();
    canvas.attr('width', width);
    canvas.attr('height', height);
    pathCanvas.attr('width', width);
    pathCanvas.attr('height', height);

    let maxG = 3;
    let MAX_SUN_SIZE = 10000000;
    let system = new System({
        scale: 1,
        G: .3,
        canvas: canvas[0],
        pathCanvas: pathCanvas[0],
        timeScale: .5,
        showTrails: false
    });

    let sun = null
    sun = new Planet({
        system: system,
        name: 'Sun',
        type: 'sun',
        isMoveable: false,
        isActive: true,
        mass: 20000,
        v: {
            x: 0,
            y: 0
        },
        x: $('#content').width() / 2,
        y: $('#content').height() / 2
    });

    system.add(sun);

    // let p = null
    // p = new Planet({
    //     system: system,
    //     isMoveable: true,
    //     isActive: true,
    //     mass: 300,
    //     v: {
    //         x: 0,
    //         y: -4
    //     },
    //     x: $('#content').width()*.66,
    //     y: $('#content').height() / 2
    // });

    // system.add(p);

    $('#controls').height($('#content').innerHeight()-80)
    let autoScale = $("#auto-scale-btn");
    autoScale.on('click', () => {
        let width = Math.abs(system.data.farthest.origin.x - system.data.farthest.dest.x);
        let height = Math.abs(system.data.farthest.origin.y - system.data.farthest.dest.y);
        let xScale = system.bounds.x.max / width;
        let yScale = system.bounds.y.max / height;
        let scale = Math.min(xScale, yScale);
        system.scale = scale;
    })

    let clearTrailsBtn = $('#clear-trails-btn');
    clearTrailsBtn.on('click', ev => {
        system.pathCtx.clearRect(0, 0, system.pathCanvas.width, system.pathCanvas.height);
    })

    let showTrailsInput = $('#show-trails-input');
    showTrailsInput.attr('checked', system.showTrails);
    showTrailsInput.on('change', ev => {
        system.showTrails = ev.target.checked;
    })

    let randomBtn = $("#random-btn");
    let fixedSunInput = $("#fixed-sun-input");
    fixedSunInput.on('change', (ev) => {
        system.planets[0].isMoveable = !ev.target.checked;
    });

    if (sun) {
        let sunMassSlider = new Slider('sun-mass-slider', {
            min: 0,
            max: 1000,
            value: 1000 * sun.mass / MAX_SUN_SIZE
        });
        sunMassSlider.valueText = sun.mass;

        sunMassSlider.on('input', ev => {
            sun.mass = MAX_SUN_SIZE * (ev.target.value / 1000);
            sunMassSlider.valueText = Math.round(sun.mass);
            sun.draw();
        })
    }

    let timeSlider = new Slider('time-scale-input', {
        min: 1,
        max: 100,
        value: 1/system.timeScale
    });
    timeSlider.valueText = system.timeScale.toFixed(2);
    timeSlider.on('input', ev => {
        system.timeScale = 1/ev.target.value;
        timeSlider.valueText = system.timeScale.toFixed(2);
    })

    let gSlider = new Slider('g-constant-input', {
        min: 0,
        max: 100,
        value: 100 * system.G / maxG
    });
    gSlider.valueText = system.G.toFixed(2);
    gSlider.on('input', ev => {
        system.G = maxG * (ev.target.value / 100);
        gSlider.valueText = system.G.toFixed(2);
    })

    let scaleSlider = new Slider('scale-input', {
        min: 1,
        max: 100,
        value: 1,
    });
    scaleSlider.valueText = 1;
    scaleSlider.on('input', ev => {
        let scale = Math.min(1, 5 / Math.pow(ev.target.value, 1.8));
        scaleSlider.valueText = scale.toFixed(2);
        system.scale = scale;
    });

    randomBtn.on('click', fillRandomPlanets)

    $('#content').on('mousedown', createPlanet);

    function createPlanet(ev) {
        $('#content').off('mousedown');

        let x = ev.clientX;
        let y = ev.clientY;
        let planet = new Planet({
            system: system,
            isMoveable: true,
            isActive: false,
            mass: 300,
            v: {
                x: 0,
                y: 0
            },
            x: x,
            y: y
        });
        system.add(planet);


        $('#content').on('mousemove', sizePlanet);
        $('#content').on('mouseup', addPlanet);

        function sizePlanet(ev) {
            let vector = new Vector(system.fromScaled({ x: x, y: y }), system.fromScaled({ x: ev.clientX, y: ev.clientY }));
            planet.mass = Math.pow(vector.mag / 3, 3);
            //planet.draw();
        }

        function addPlanet(ev) {
            if (!planet.mass) {
                planet.mass = 500;
                planet.draw();
            }
            $('#content').off('mouseup');
            $('#content').off('mousemove');
            $('#content').off('mousedown');
            $('#content').on('mousedown', startVelocity)

            function startVelocity(ev) {
                $('#content').off('mousedown');
                let line = $("<div class = 'rubber-band'>");
                let origin = system.toScaled({
                    x: planet.x,
                    y: planet.y
                })
                line.css('top', origin.y);
                line.css('left', origin.x + 1);
                line.height(0);
                line.width(0);
                $('#content').append(line);

                $('#content').on('mousemove', setVelocity);
                $('#content').on('mouseup', launchPlanet)

                function setVelocity(ev) {

                    let vector = new Vector(origin,
                        {
                            x: ev.clientX,
                            y: ev.clientY
                        });

                    let endPoint = system.fromScaled({
                        x: ev.clientX,
                        y: ev.clientY
                    })

                    let mag = {
                        x: planet.x - endPoint.x,
                        y: planet.y - endPoint.y
                    }

                    let v = {
                        x:  (Math.sign(mag.x) * Math.pow(Math.abs(mag.x), 1.1) / 30) * planet.system.timeScale,
                        y:  (Math.sign(mag.y) * Math.pow(Math.abs(mag.y), 1.1) / 10) * planet.system.timeScale
                    }

                    planet.v = v;
                    line.height(vector.mag);
                    line.css('transform', `rotate(${Math.PI / 2 - vector.angle}rad)`);
                }


                function launchPlanet(ev) {
                    $('#content').off('mouseup');
                    $('#content').off('mousemove');
                    $('#content').off('mousedown');
                    line.remove();
                    planet.isActive = true;
                    $('#content').on('mousedown', createPlanet);
                }
            }
        }
    }

    system.run();
})




