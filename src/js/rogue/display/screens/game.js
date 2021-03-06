
import _ from 'lodash';
import ROT from 'rot-js';
import { Screen } from '../screen';
import MessageQueue from '../message-handler';
import GameState from '../../init/gamestate';
import Settings from '../../constants/settings';
import ChangeTitle from '../../lib/page-title';

export class GameScreen extends Screen {

  static getScreenOffsets(centerPoint = GameState.players[0], width = Settings.screen.width, height = Settings.screen.height) {
    let topLeftX = Math.max(0, centerPoint.x - Math.round(width/2));
    topLeftX = Math.min(topLeftX, GameState.world.width - width);

    let topLeftY = Math.max(0, centerPoint.y - Math.round(height/2));
    topLeftY = Math.min(topLeftY, GameState.world.height - height);

    return {
      x: topLeftX,
      y: topLeftY
    };
  }

  static drawTiles(display, centerPoint, options = { width: Settings.screen.width, height: Settings.screen.height, offset: this.getScreenOffsets(), gameOffset: { x: 0, y: 0 } }) {

    const { width, height, offset, gameOffset } = options;

    const visible = [];

    const world = GameState.world;
    const zLevel = centerPoint.z;

    const isDead = centerPoint.hp.atMin();

    const fov = world.fov[zLevel];
    fov.compute(
      centerPoint.x, centerPoint.y, isDead ? 1 : centerPoint.getSight(),
      (x, y) => {
        if(!visible[x]) visible[x] = [];
        visible[x][y] = true;
        world.setExplored(x, y, zLevel, true);
      }
    );

    let cache = {};
    _.each(['Telepathy', 'Clairvoyance', 'Warning'], (trait) => cache[trait] = centerPoint.getTraitValue(trait));

    let projectileCache = {};
    _.each(GameState.projectiles, (proj) => projectileCache[`${proj.x},${proj.y}`] = proj);

    let lightingCache = {};

    const lights = GameState.world.lighting[zLevel];
    if(lights && lights.length > 0) {
      const reflectivity = (x, y) => GameState.world.getTile(x, y, zLevel).reflect;
      const lighting = new ROT.Lighting(reflectivity, { range: 5, passes: 2 });
      lighting.setFOV(fov);

      _.each(lights, light => lighting.setLight(light.x, light.y, light._lightColor));

      const lightCallback = (x, y, color) => lightingCache[`${x},${y}`] = color;
      lighting.compute(lightCallback);
    }

    const isVisible = (x, y) => {
      return visible[x] && visible[x][y];
    };

    const hasValid = (trait, x, y) => {
      return !isDead && cache[trait] && centerPoint.distBetweenXY(x, y) <= cache[trait];
    };

    // white (doesn't count), green, yellow, orange, red, purple
    const warningColors = ['#fff', '#0f0', '#ff0', '#ffa500', '#f00', '#ff0'];
    const ambientLight = [30, 30, 30];

    for(let x = offset.x; x < offset.x + width; x++) {
      for(let y = offset.y; y < offset.y + height; y++) {
        const hasTelepathy = hasValid('Telepathy', x, y);
        const hasClairvoyance = hasValid('Clairvoyance', x, y);
        const hasWarning = hasValid('Warning', x, y);
        const hasSeen = GameState.world.isExplored(x, y, centerPoint.z);
        if(!hasSeen && !GameState.renderAll && !hasTelepathy && !hasClairvoyance && !hasWarning) continue;

        const tile = world.getTile(x, y, zLevel);
        if(!tile) continue; // no out of bounds drawing

        let glyph = { key: null };
        let foreground = null;
        let background = ROT.Color.fromString('#000');

        const baseIsVisible = isVisible(x, y) || hasClairvoyance;

        if(baseIsVisible || hasSeen) {
          glyph = tile.glyph;
          foreground = glyph.fg;
          if(glyph.bg) background = ROT.Color.fromString(glyph.bg);
        }

        if(baseIsVisible) {
          const items = world.getItemsAt(x, y, zLevel);
          if (items && items.length > 0) {
            glyph = items[items.length - 1].glyph;
            foreground = glyph.fg;
          }
        }

        if(baseIsVisible || hasTelepathy || hasWarning) {
          const entity = world.getEntity(x, y, zLevel);
          if(entity) {

            if(baseIsVisible || hasTelepathy) {
              glyph = entity.glyph;
              foreground = glyph.fg;

            } else if(hasWarning && centerPoint.canAttack(entity)) {
              const difficulty = centerPoint.calcDifficulty(entity);
              glyph = { key: difficulty };
              foreground = warningColors[difficulty];
            }
          }
        }

        const projectile = projectileCache[`${x},${y}`];
        if(baseIsVisible && projectile) {
          glyph = projectile.glyph;
          foreground = glyph.fg;
        }

        // visible things have a black background
        if(baseIsVisible) {
          background = ROT.Color.fromString('#333');
        }

        const light = lightingCache[`${x},${y}`];
        if(baseIsVisible && light) {
          background = ROT.Color.add(light, ambientLight);
        }

        // prevent taking color away from things that have it
        if(!baseIsVisible && !foreground) {
          foreground = '#555';
        }

        display.draw(gameOffset.x + x - offset.x, gameOffset.y + y - offset.y, glyph.key, foreground, ROT.Color.toRGB(background));

      }
    }

    cache = null;
    projectileCache = null;
    lightingCache = null;
  }

  static render() {
    const livingPlayers = _.reject(GameState.players, (player) => player.hp.atMin());
    const playerString = GameState.players.length > 1 ? ` (${livingPlayers.length}/${GameState.players.length})` : '';
    ChangeTitle(`Dungeoneering${playerString}`);
  }

  static redrawHp(display, foreground, player, string, x = 0, y = Settings.screen.height - 1) {
    const str = (''+player.hp.cur);
    const index = string.indexOf(`HP:${player.hp.cur}`)+3;
    const length = str.length;
    const strIdx = 0;
    for(let i = index; i < index+length; i++) {
      display.draw(x+i, y, str[strIdx], foreground);
    }
  }
}

export class SingleGameScreen extends GameScreen {

  static drawMessages(display, player) {

    if(!GameState.messages) return;

    for(let y = 0; y < 3; y++) {

      for(let x = 0; x < Settings.screen.width; x++) {
        display.drawText(x, y, ' ');
      }
    }

    for(let y = 0; y < 3; y++) {
      const messageObj = GameState.messages[y];
      if(!messageObj || messageObj.turn < player.currentTurn - 4) continue;
      display.drawText(0, y, messageObj.message);
    }

    MessageQueue.viewAllMessages();
  }

  static drawHUD(display, player) {
    const tag = `${player.name} the ${player.getAlign()} ${player.gender} level ${player.level} ${player.race} ${player.professionInst.title} (${player.xp.cur}/${player.xp.max})`;
    const stats = `STR:${player.getStr()} DEX:${player.getDex()} CON:${player.getCon()} INT:${player.getInt()} WIS:${player.getWis()} CHA:${player.getCha()} AC:${player.getAC()}`;
    const miscInfo = `Floor:${1+GameState.currentFloor} (${GameState.world.tiles[GameState.currentFloor].shortMapName}) $:${player.gold} HP:${player.hp.cur}/${player.hp.max} MP:${player.mp.cur}/${player.mp.max} Turn:${player.currentTurn}`;

    for(let y = 1; y <= 3; y++) {
      for(let x = 0; x < Settings.screen.width; x++) {
        display.drawText(x, Settings.screen.height - y, ' ');
      }
    }

    display.drawText(0, Settings.screen.height - 3, tag);
    display.drawText(0, Settings.screen.height - 2, stats);
    display.drawText(0, Settings.screen.height - 1, miscInfo);

    if(player.hp.ltePercent(20)) {
      this.redrawHp(display, '#7f0000', player, miscInfo);
    } else if(player.hp.ltePercent(50)) {
      this.redrawHp(display, '#ffd700', player, miscInfo);
    }
  }

  static render(display) {
    super.render(display);
    const player = GameState.players[0];
    this.drawTiles(display, player);
    this.drawHUD(display, player);
    this.drawMessages(display, player);
  }

  static get split() { return SplitGameScreen; }
}

export class SplitGameScreen extends GameScreen {

  static enter() {
    this.width = GameState.players.length > 2 ? (Settings.screen.width / 2) : Settings.screen.width;
    this.height = Settings.screen.height / 2;

    this.tlCoords = [
      { x: 0, y: 0 },
      { x: 0, y: this.height+1 },
      { x: this.width+1, y: 0 },
      { x: this.width+1, y: this.height+1 }
    ];

    this.hudCoords = [
      { x: 0, y: this.height-1 },
      { x: 0, y: (this.height*2)-1 },
      { x: this.width+1, y: this.height-1 },
      { x: this.width+1, y: (this.height*2)-1 }
    ];
  }

  static render(display) {
    super.render(display);

    _.each(GameState.players, (player, i) => {
      this.drawTiles(display, player, { width: this.width, height: this.height, offset: this.getScreenOffsets(player, this.width, this.height), gameOffset: this.tlCoords[i] });
      this.drawHUDs(display, player, this.hudCoords[i]);
    });

    this.drawBorder(display);
  }

  static drawBorder(display) {

    const middleY = Settings.screen.height / 2;
    for(let i = 0; i < Settings.screen.width; i++) {
      display.draw(i, middleY, '=');
    }

    if(GameState.players.length > 2) {
      const middleX = Settings.screen.width / 2;
      for(let i = 0; i < Settings.screen.height; i++) {
        display.draw(middleX, i, '‖');
      }
    }

    this.drawLeftCenterText(display, middleY, `Floor:${GameState.currentFloor+1} (${GameState.world.tiles[GameState.currentFloor].shortMapName})`);
    this.drawRightCenterText(display, middleY, `Turns:${_.max(GameState.players, 'currentTurn').currentTurn}`);
  }

  static stripTo3(string) {
    return string.substring(0, 3);
  }

  static drawHUDs(display, player, hudCoords) {
    const { x, y } = hudCoords;

    const topString = `${player.name} ${this.stripTo3(player.getAlign())} ${this.stripTo3(player.gender)} ${this.stripTo3(player.race)} ${this.stripTo3(player.profession)}`;
    const bottomString = `Lv.${player.level} (${player.xp.cur}/${player.xp.max}) HP:${player.hp.cur}/${player.hp.max} MP:${player.mp.cur}/${player.mp.max}`;

    display.drawText(x, y-1, topString);
    display.drawText(x, y, bottomString);

    if(player.hp.ltePercent(20)) {
      this.redrawHp(display, '#7f0000', player, bottomString, x, y);
    } else if(player.hp.ltePercent(50)) {
      this.redrawHp(display, '#ffd700', player, bottomString, x, y);
    }
  }

  static get split() { return SingleGameScreen; }
}
