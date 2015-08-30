
import Profession from '../../definitions/profession';
import * as Traits from '../traits/_all';

let monsterCfg = {
  traits: [Traits.Infravision(7)]
};

export default class Monster extends Profession {
  constructor() {
    super(monsterCfg);
  }
}