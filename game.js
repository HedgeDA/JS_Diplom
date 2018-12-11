'use strict';

class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    plus(vector) {
        if (!(vector instanceof Vector)) {
            throw new Error('Можно прибавлять к вектору только вектор типа Vector');
        }

        return new Vector(this.x + vector.x, this.y + vector.y);
    }
    
    times(multiplier) {
        return new Vector(this.x * multiplier, this.y * multiplier);
    }
}

class Actor {
    constructor(pos = new Vector(), size = new Vector(1, 1), speed = new Vector()) {
        if (!(pos instanceof Vector) || !(size instanceof Vector) || !(speed instanceof Vector)) {
            throw new Error('Не верный тип параметра объекта класса Actor');
        }

        this.pos = pos;
        this.size = size;
        this.speed = speed;
    }

    act() {}

    get left() {
        return this.pos.x;
    }

    get top() {
        return this.pos.y;
    }

    get right() {
        return this.pos.x + this.size.x;
    }

    get bottom() {
        return this.pos.y + this.size.y;
    }

    get type() {
        return 'actor';
    }

    isIntersect(actor) {
        if (!(actor instanceof Actor)) {
            throw new Error('Не верный тип параметра объекта Actor для метода isIntersect')
        }

        if (actor === this) {
            return false;
        }

        return this.left < actor.right && this.right > actor.left &&
            this.top < actor.bottom && this.bottom > actor.top;
    }
}

class Level {
    constructor(grid = [], actors = []) {
        this.grid = grid;
        this.actors = actors;

        this.player = actors.find(actor => actor.type === 'player');

        this.height = Math.max(0, grid.length);

        this.width = Math.max(0, Math.max(...grid.map(line => line.length)));

        this.status = null;
        this.finishDelay = 1;
    }

    isFinished() {
        return (this.status !== null && this.finishDelay < 0);
    }

    actorAt(movingActor) {
        if (!(movingActor instanceof Actor)) {
            throw new Error('Не верный тип параметра объекта Level для метода actorAt')
        }

        for (let actor of this.actors) {
            if (actor.isIntersect(movingActor)) return actor;
        }

        return;
    }

    obstacleAt(direction, size) {
        if (!(direction instanceof Vector) || !(size instanceof Vector)) {
            throw new Error('Не верный тип параметра объекта Level для метода obstacleAt')
        }

        let area = new Actor(direction, size);

        if (area.left < 0 || area.top < 0 || area.right > this.width) {
            return 'wall';
        }

        if (area.bottom > this.height) {
            return 'lava';
        }

        for (let column = Math.floor(area.top); column < Math.ceil(area.bottom); column++) {
            for (let line = Math.floor(area.left); line < Math.ceil(area.right); line++) {
                if (this.grid[column][line] !== undefined) {
                    return this.grid[column][line];
                }
            }
        }

        return;
    }

    removeActor(deletingActor) {
        this.actors = this.actors.filter(actor => actor.pos !== deletingActor.pos || actor.size !== deletingActor.size);
    }

    noMoreActors(type) {
        return this.actors.find(actor => actor.type === type) === undefined;
    }

    playerTouched(type, actor = new Actor()) {
        if (type === 'lava' || type === 'fireball') {
            this.status = 'lost';

            return;
        }

        if (type === actor.type) {
            this.removeActor(actor);

            if (this.noMoreActors('coin')) {
                this.status = 'won';
            }
        }
    }
}

class LevelParser {
    constructor(actorsDict = {}) {
        this.actorsDict = actorsDict;
    }

    actorFromSymbol(symbol) {
        if (symbol === undefined) {
            return undefined;
        } else {
            return this.actorsDict[symbol];
        }
    }

    obstacleFromSymbol(symbol) {
        switch (symbol) {
            case 'x': return 'wall';
            case '!': return 'lava';
            default: return
        }
    }

    createGrid(plan) {
        return plan.map(
            item => item.split('').map(symbol => this.obstacleFromSymbol(symbol))
        );
    }

    createActors(plan) {
        const result = [];

        plan.forEach((item, y) => {
            item.split('').forEach((symbol, x) => {
                if (typeof this.actorsDict[symbol] === 'function') {
                    let actor = new this.actorsDict[symbol](new Vector(x, y));

                    if (actor instanceof Actor) {
                        result.push(actor);
                    }
                }
            })
        });

        return result;
    }

    parse(plan) {
        return new Level(this.createGrid(plan), this.createActors(plan));
    }
}

class Fireball extends Actor {
    constructor(pos = new Vector(), speed = new Vector()) {
        super(pos, new Vector(1,1), speed);
    }

    get type() {
        return 'fireball';
    }

    getNextPosition(time = 1) {
        return this.pos.plus(this.speed.times(time));
    }

    handleObstacle() {
        [this.speed.x, this.speed.y] = [-this.speed.x, -this.speed.y];
    }

    act(time, level) {
        let nextPosition = this.getNextPosition(time);

        if (level.obstacleAt(nextPosition, this.size) !== undefined) {
            this.handleObstacle();

            return;
        }

        this.pos = nextPosition;
    }
}

class HorizontalFireball extends Fireball{
    constructor(pos) {
        super(pos, new Vector(2, 0));
    }
}

class VerticalFireball extends Fireball{
    constructor(pos) {
        super(pos, new Vector(0, 2));
    }
}

class FireRain extends Fireball{
    constructor(pos) {
        super(pos, new Vector(0, 3));

        this.startPos = pos;
    }

    handleObstacle() {
        this.pos = this.startPos;
    }
}

function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

class Coin extends Actor {
    constructor(pos = new Vector()) {
        super(pos.plus(new Vector(0.2, 0.1)), new Vector(0.6, 0.6));

        this.startPos = pos.plus(new Vector(0.2, 0.1));
        this.springSpeed = 8;
        this.springDist = 0.07;
        this.spring = getRandomFloat(0, Math.PI * 2);
    }

    get type() {
        return 'coin';
    }

    updateSpring(time = 1) {
        this.spring += this.springSpeed * time;
    }

    getSpringVector() {
        return new Vector(0, Math.sin(this.spring) * this.springDist);
    }

    getNextPosition(time = 1) {
        this.updateSpring(time);

        return this.startPos.plus(this.getSpringVector());
    }

    act(time) {
        this.pos = this.getNextPosition(time);
    }
}

class Player extends Actor {
    constructor(pos = new Vector()) {
        super(pos.plus(new Vector(0, -0.5)), new Vector(0.8, 1.5));
    }

    get type() {
        return 'player';
    }
}

const actorsDict = Object.create(null);
actorsDict['@'] = Player;
actorsDict['o'] = Coin;
actorsDict['='] = HorizontalFireball;
actorsDict['|'] = VerticalFireball;
actorsDict['v'] = FireRain;

const parser = new LevelParser(actorsDict);

loadLevels()
    .then(result => runGame(JSON.parse(result), parser, DOMDisplay))
        .then(status => alert(`Вы прошли все уровни!`));