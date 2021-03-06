
import Entity from './entity';
import { WeightedExtension } from '../lib/rot-extensions';

export default class Tile extends Entity {
  constructor(key, fg, bg) {
    super({ key: key, fg: fg, bg: bg });
    this.density = 0;
    this.opacity = 0;
    this.reflect = 0.3;
  }

  ceaseExisting() {
    this.glyph.key = '.';
    this.glyph.fg = '';
    this.glyph.bg = '';
    this.canInteract = undefined;
  }

  getRandomEffect(effects) {
    return WeightedExtension(effects).value;
  }
}