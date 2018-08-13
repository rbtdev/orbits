$(document).ready(function () {
    let system = new System();
    $(document).on('mousedown', createPlanet);

    function createPlanet(ev) {
        $(document).off('mousedown');

        let x = ev.clientX;
        let y = ev.clientY;
        let planet = new Planet({
            name: `p${system.planets.length}`,
            isMoveable: true,
            mass: 0,
            x: x,
            y: y
        });

        $(document).on('mousemove', sizePlanet);
        $(document).on('mouseup', addPlanet);

        function sizePlanet(ev) {
            let vector = new Vector({ x: x, y: y }, { x: ev.clientX, y: ev.clientY });
            planet.mass = Math.pow(vector.mag * 2, 2)
            planet.setRadius();
        }

        function addPlanet(ev) {
            if (!planet.mass) {
                planet.mass = 500;
                planet.setRadius();
            }
            $(document).off('mouseup');
            $(document).off('mousemove');
            $(document).off('mousedown');
            $(document).on('mousedown', startVelocity)

            function startVelocity(ev) {
                $(document).off('mousedown');
                let line = $("<div class = 'rubber-band'>");
                line.css('top', planet.y);
                line.css('left', planet.x + 1);
                line.height(0);
                line.width(0);
                $('#content').append(line);

                $(document).on('mousemove', setVelocity);
                $(document).on('mouseup', launchPlanet)

                function setVelocity(ev) {
                    let vector = new Vector(planet,
                        {
                            x: ev.clientX,
                            y: ev.clientY
                        });

                    line.height(vector.mag);
                    line.css('transform', `rotate(${Math.PI / 2 - vector.angle}rad)`);
                }


                function launchPlanet(ev) {
                    $(document).off('mouseup');
                    $(document).off('mousemove');
                    $(document).off('mousedown');

                    line.remove();

                    let mag = {
                        x: planet.x - ev.clientX,
                        y: planet.y - ev.clientY
                    }
                    let v = {
                        x: Math.sign(mag.x) * Math.pow(Math.abs(mag.x), 1.2) / 75,
                        y: Math.sign(mag.y) * Math.pow(Math.abs(mag.y), 1.2) / 75
                    }
                    planet.v = v;
                    system.add(planet);
                    $(document).on('mousedown', createPlanet);
                }
            }
        }
    }

    let sun = new Planet({
        name: 'Sun',
        isMoveable: false,
        mass: 20000,
        v: {
            x: 0,
            y: 0
        },
        x: $('#content').width() / 2,
        y: $('#content').height() / 2
    });

    system.add(sun);

    // for (let p = 1; p < 0; p++) {
    //     planets.push(new Planet({
    //         name: `p${p}`,
    //         isMoveable: true,
    //         mass: Math.random() * 100 + 1,
    //         v: {
    //             x: Math.random() * 20 - 10,
    //             y: Math.random() * 20 - 10
    //         },
    //         x: Math.random() * $('#content').width(),
    //         y: Math.random() * $('#content').height()
    //     }));
    // }

    system.run();
})


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
}


class System {
    constructor() {
        this.planets = [];
        this.G = .2
        this.swallows = [];
        this.t = 0;
    }
    

    add(planet) {
        this.planets.push(planet);
    }

    run() {
        this.swallows.forEach(swallow => {
            swallow.subject.swallow(swallow.object, swallow.vector);
        });
        this.swallows = [];

        this.planets.forEach((subject, i) => {
            let f = {
                x: 0,
                y: 0
            }
            this.planets.forEach((object, j) => {
                if (i !== j) {
                    let V = new Vector(object, subject);
                    let minDistance = object.radius + subject.radius;
                    if (V.mag >= minDistance) {
                        let fMag = this.G * (subject.mass * object.mass) / (V.mag * V.mag);
                        f.x += -fMag * Math.cos(V.angle);
                        f.y += fMag * Math.sin(V.angle);
                    } else {
                        if (object.mass >= subject.mass) {

                            this.swallows.push({
                                subject: object,
                                object: this.planets.splice(i, 1)[0],
                                vector: V
                            })

                        }
                        else {
                            this.swallows.push({
                                object: this.planets.splice(j, 1)[0],
                                subject: subject,
                                vector: V
                            })

                        }
                    }
                }
            })
            subject.force = f;
        });

        this.planets.forEach(planet => {
            planet.move();
        });
        this.t++
        requestAnimationFrame(this.run.bind(this));
    }
}

class Planet {
    constructor(opts) {
        this.name = opts.name;
        this.isMoveable = opts.isMoveable;
        this.mass = opts.mass;
        this.v = opts.v;
        this.x = opts.x;
        this.y = opts.y;
        this.force = {
            x: 0,
            y: 0
        }
        this.div = $('<div class = "planet">');
        this.setRadius();
        this.setPosition();
        $('#content').append(this.div);

    }

    swallow(planet) {
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
        this.setRadius();
        planet.remove();
    }

    remove() {
        this.div.css('display', 'none');
    }

    move() {
        if (this.isMoveable) {
            let a = {
                x: this.force.x / this.mass,
                y: this.force.y / this.mass
            }
            this.v = {
                x: this.v.x + a.x,
                y: this.v.y + a.y
            }

            this.x = this.x + this.v.x;
            this.y = this.y + this.v.y;
            this.setPosition(this.x, this.y);
        }
    }

    setPosition() {
        this.div.css('top', this.y - this.radius);
        this.div.css('left', this.x - this.radius);
    }

    setRadius() {
        this.radius = Math.sqrt(this.mass) / 2;
        this.div.width(this.radius * 2);
        this.div.height(this.radius * 2);
        this.setPosition();
    }
}


