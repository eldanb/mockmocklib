type PropertySetupOperations<T> = {
  returns(t: T): void; 
  ofType<R extends T>(t: new(...args) => R): PropertySetup<R>;
  setup(sf: (st: ObjectSetup<T>) => void): void 
}

type PropertySetup<T> = 
  ObjectSetup<T> & 
  (T extends (...args: any) => any ? (((...args: Parameters<T>) => PropertySetup<ReturnType<T>>)) : ObjectSetup<T>)  & 
  PropertySetupOperations<T>;

type ObjectSetup<O> = {
  [field in keyof O]: PropertySetup<O[field]>;
};

function CollapseValueHolders(vh) {
  let heldVal = vh?._v;
  if(heldVal instanceof MockBlueprint) {
    return heldVal.compile();
  } else {
    return heldVal;
  }
}

class MockBlueprint extends Function {
  constructor() {
    super(); 
  }
  
  compile(): any {}
};

class MockValueBlueprint extends MockBlueprint {
  public v: any;

  constructor() {
    super();
  }

  compile() {
    if(this.v instanceof MockBlueprint) {
      return this.v.compile();
    } else {
      return this.v;
    }
  }

  blueprintValue<T extends MockBlueprint>(Ttor: new () => T): T {
    if(!this.v) {
      this.v = new Ttor();
    }

    if(! (this.v instanceof Ttor)) {
      throw new Error(`Expecting a blueprint of type ${Ttor.name}`)
    }

    return this.v;
  }
}

class MockObjectBlueprint extends MockBlueprint {
  public v: { [index: string | symbol]: MockValueBlueprint } = {};
  public ofType: new (...args) => any;

  constructor() {
    super();
  }

  compile() {    
    const ret = {};
    Object.entries(this.v).forEach(([k, v]) => {      
      ret[k] = v.compile();
    });

    return this.ofType ? 
            this.createTypedProxy(ret, this.ofType) : 
            ret;
  }


  private createTypedProxy(data: any, type: new (...args: any) => any) {    
    return new Proxy(data, {
      get(target, p) { return target[p]; },
      apply(target, thisArg, args) { return target.apply(thisArg, args); },
      getPrototypeOf(target) { return type.prototype; }
    });
  }

}


class MockFunctionBlueprint extends MockBlueprint {
  public dispatchTable: { [serializedArgs: string]: MockValueBlueprint } = {};
  
  constructor() {
    super();
  }
  
  compile() {
    return (...args: any) => {
      return this.dispatchTable[JSON.stringify(args)].compile();
    }
  };    
}

type PropertySetupOperationHandlersInterface = {
  [oper in keyof PropertySetupOperations<any>]: 
    (proxyBuilder, valueHolder: MockValueBlueprint, ...args: Parameters<PropertySetupOperations<any>[oper]>) => 
      ReturnType<PropertySetupOperations<any>[oper]>;
}

const PropertySetupOperationHandlers: PropertySetupOperationHandlersInterface = {
  returns(proxyBuilder, valueHolder: MockValueBlueprint, retVal) {
    valueHolder.v = retVal;
  },

  ofType(proxyBuilder, valueHolder: MockValueBlueprint, ctor) {
    const objectBlueprint = valueHolder.blueprintValue(MockObjectBlueprint);
    objectBlueprint.ofType = ctor;

    return proxyBuilder;
  },

  setup(proxyBuilder, valueHolder: MockValueBlueprint, setupFunc) {
    setupFunc(proxyBuilder);
  },
};

function CreateSetupProxy(valueHolder: MockValueBlueprint) {  
  const proxyBuilder = new Proxy(valueHolder, {
    
    get(target, propertyName) {
      if(PropertySetupOperationHandlers[propertyName]) {
        return (...args: any) => (PropertySetupOperationHandlers[propertyName] as (...any) => any).apply(null, [proxyBuilder, target, ...args]);
      } else {        
        const objectBlueprint = target.blueprintValue(MockObjectBlueprint);

        if(!objectBlueprint.v[propertyName]) {
          objectBlueprint.v[propertyName] = new MockValueBlueprint();
        } 

        return CreateSetupProxy(objectBlueprint.v[propertyName]);
      }
    }, 

    apply(target, thisArg, args) {
      const invokeResultHolder = new MockValueBlueprint();

      const fnBlueprint = target.blueprintValue(MockFunctionBlueprint);
      fnBlueprint.dispatchTable[JSON.stringify(args)] = invokeResultHolder;      

      return CreateSetupProxy(invokeResultHolder);
    }
  });

  return proxyBuilder;
}

export function mock<T>(setupFunction: (d: ObjectSetup<T>) => void): T {
  const mockData = new MockValueBlueprint();
  
  const objSetup = CreateSetupProxy(mockData);
  setupFunction(objSetup);

  return mockData.compile();
}
