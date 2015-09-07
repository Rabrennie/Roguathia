
import Profession from '../../definitions/profession';
import * as Traits from '../traits/_all';

const monsterCfg = {
  hp  : '1d1',
  str : '1d1',
  con : '1d1',
  int : '1d1',
  dex : '1d1',
  wis : '1d1',
  cha : '1d1',
  traits: [Traits.Infravision({ level: 7 })]
};

export default class Monster extends Profession {
  constructor() {
    super(monsterCfg);
  }
}