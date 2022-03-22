
import { mock } from './MockMockLibrary';

class FirstObject {
  a: number;
  b: SecondObject;
  c: (n: number) => SecondObject;
}

class SecondObject {
  z: SecondObject;
  zz: FirstObject;

  constructor(public d:number) {}
}

class ThirdObject extends SecondObject {
  we: string;
}

const mockmockmock = mock<FirstObject>((setup) => {
  setup.c(4).d.returns(16);
});
console.log(mockmockmock.c(4).d)

const mockmock = mock<FirstObject>((setup) => {
  setup.a.returns(3);
  setup.b.ofType(ThirdObject).setup((s) => { 
    s.we.returns("yeah");
    s.d.returns(90);
  });
  
  setup.c(4).d.returns(16);
  setup.c(9).ofType(SecondObject).setup((o) => { 
    o.d.returns(99);
    o.z.d.returns(101);
  });
  setup.c(11).zz.c(12).d.returns(3.14);  
});

console.log(mockmock);
console.log(mockmock.a, mockmock.b.d, mockmock.c(4).d, mockmock.c(9).d, mockmock.c(9).z?.d);
console.log(mockmock.b instanceof SecondObject);
console.log(mockmock.c(11).zz?.c(12).d);
