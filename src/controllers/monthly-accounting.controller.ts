import {inject, service} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  Response,
  response,
  RestBindings,
} from '@loopback/rest';
import {AccountingDebts, DebtsCustomer} from '../@types/accountingDebts';
import {MonthlyAccounting} from '../models';
import {CustomerRepository, MonthlyAccountingRepository} from '../repositories';
import {AccountingService} from '../services/accounting.service';
import {PdfGeneratorService} from '../services/pdf.service';
//@authenticate('jwt')
export class MonthlyAccountingController {
  constructor(
    @repository(MonthlyAccountingRepository)
    public monthlyAccountingRepository: MonthlyAccountingRepository,
    @repository(CustomerRepository)
    public customerRepository: CustomerRepository,
    @service(AccountingService)
    public accountingService: AccountingService,
    @inject('services.PdfGeneratorService')
    protected pdfService: PdfGeneratorService,
  ) {}

  @post('/monthly-accountings')
  @response(200, {
    description: 'MonthlyAccounting model instance',
    content: {
      'application/json': {schema: getModelSchemaRef(MonthlyAccounting)},
    },
  })
  async create(): Promise<void> {
    const customers = await this.customerRepository.find({
      fields: {id: true, periodicity: true, honorary: true, rfc: true},
      where: {
        status: true,
      },
    });

    for (const customer of customers) {
      await this.accountingService.generateMonthlyAccounting(
        customer.id,
        customer.periodicity,
        customer.honorary,
        customer.rfc,
      );
    }
  }

  @get('/monthly-accountings/{id}')
  @response(200, {
    description: 'MonthlyAccounting model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(MonthlyAccounting, {includeRelations: true}),
      },
    },
  })
  async findBy(
    @param.path.number('id') id: number,
    @param.filter(MonthlyAccounting, {exclude: 'where'})
    filter?: FilterExcludingWhere<MonthlyAccounting>,
  ): Promise<MonthlyAccounting> {
    return this.monthlyAccountingRepository.findById(id, filter);
  }
  @get('/monthly-accountings')
  @response(200, {
    description: 'Array of MonthlyAccounting model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(MonthlyAccounting, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(MonthlyAccounting) filter?: Filter<MonthlyAccounting>,
  ): Promise<MonthlyAccounting[]> {
    return this.monthlyAccountingRepository.find(filter);
  }

  @get('/monthly-accountings/debts/customer/{id}')
  @response(200, {
    description: 'Deudas de clientes',
    content: {
      'application/json': {schema: {type: 'array', items: {type: 'number'}}},
    },
  })
  async getDebts(@param.path.number('id') id: number): Promise<DebtsCustomer> {
    const accountings = await this.monthlyAccountingRepository.find({
      where: {
        customerId: id,
      },
      include: [
        {
          relation: 'paymets',
        },
      ],
    });

    const accountingWithTotals = accountings.map(accounting => {
      const total =
        accounting.paymets?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;

      if (accounting.honorary == total) return undefined;

      const debts = accounting.honorary - total;
      return {
        id: accounting.id,
        total,
        month: accounting.month,
        year: accounting.year,
        honorary: accounting.honorary,
        debts,
      };
    });

    const customer = await this.customerRepository.findById(id);

    const filter = accountingWithTotals.filter(
      (item): item is AccountingDebts => item !== undefined,
    );
    const debtsCustomer = {
      name: customer.socialReason,
      rfc: customer.rfc,
      debts: filter,
    };
    return debtsCustomer;
  }

  @get('/monthly-accountings/years')
  @response(200, {
    description: 'Años únicos de MonthlyAccounting',
    content: {
      'application/json': {schema: {type: 'array', items: {type: 'number'}}},
    },
  })
  async getUniqueYears(): Promise<number[]> {
    const results = await this.monthlyAccountingRepository.find({
      fields: {year: true}, // solo trae la propiedad year
    });

    // Extrae solo los años únicos
    const uniqueYears = [...new Set(results.map(item => item.year))];

    return uniqueYears;
  }

  @patch('/monthly-accountings')
  @response(200, {
    description: 'MonthlyAccounting PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(MonthlyAccounting, {partial: true}),
        },
      },
    })
    monthlyAccounting: MonthlyAccounting,
    @param.where(MonthlyAccounting) where?: Where<MonthlyAccounting>,
  ): Promise<Count> {
    return this.monthlyAccountingRepository.updateAll(monthlyAccounting, where);
  }

  @get('/monthly-accountings/{id}')
  @response(200, {
    description: 'MonthlyAccounting model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(MonthlyAccounting, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(MonthlyAccounting, {exclude: 'where'})
    filter?: FilterExcludingWhere<MonthlyAccounting>,
  ): Promise<MonthlyAccounting> {
    return this.monthlyAccountingRepository.findById(id, filter);
  }

  @patch('/monthly-accountings/{id}')
  @response(204, {
    description: 'MonthlyAccounting PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(MonthlyAccounting, {partial: true}),
        },
      },
    })
    monthlyAccounting: MonthlyAccounting,
  ): Promise<void> {
    await this.monthlyAccountingRepository.updateById(id, monthlyAccounting);
  }

  @post('/monthly-accountings/search')
  @response(200, {
    description: 'Array of MonthlyAccounting model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(MonthlyAccounting, {includeRelations: true}),
        },
      },
    },
  })
  async findFiltered(
    @requestBody({
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              month: {type: 'number'},
              search: {type: 'string'},
              year: {type: 'number'},
            },
          },
        },
      },
    })
    body?: {
      month?: number;
      search?: string;
      year?: number;
    },
  ): Promise<MonthlyAccounting[]> {
    const month = body?.month;
    const search = body?.search?.trim();
    const year = body?.year;

    const whereFilter: any = {};

    if (month !== undefined && year !== undefined) {
      if (month % 2 === 0) {
        // Agrupa el año con el OR de los meses
        whereFilter.and = [
          {year: year},
          {
            or: [
              {
                and: [{month: month}, {periodicity: 'BIMESTRAL'}],
              },
              {
                and: [{month: month - 1}, {periodicity: 'BIMESTRAL'}],
              },
              {
                and: [{month: month}, {periodicity: {neq: 'BIMESTRAL'}}],
              },
            ],
          },
        ];
      } else {
        whereFilter.month = month;
        whereFilter.year = year;
      }
    } else if (year !== undefined) {
      whereFilter.year = year;
    }

    const filter: Filter<MonthlyAccounting> = {
      where: whereFilter,
      include: [
        {
          relation: 'customer',
        },
        {
          relation: 'paymets',
        },
      ],
      order: ['RfcTaxPaymentDate ASC'],
    };

    const results = await this.monthlyAccountingRepository.find(filter);

    if (search) {
      return results.filter(item => {
        const rfc = item.customer?.rfc?.toLowerCase() ?? '';
        const name = item.customer?.socialReason?.toLowerCase() ?? '';
        return (
          rfc.includes(search.toLowerCase()) ||
          name.includes(search.toLowerCase())
        );
      });
    }

    return results;
  }

  @post('/monthly-accountings/debts')
  @response(200, {
    description: 'PDF generado',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async generatePdf(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: {type: 'string'},
              rfc: {type: 'string'},
              debts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: {type: 'number'},
                    total: {type: 'number'},
                    month: {type: 'number'},
                    year: {type: 'number'},
                    honorary: {type: 'number'},
                    debts: {type: 'number'},
                  },
                  required: [
                    'id',
                    'total',
                    'month',
                    'year',
                    'honorary',
                    'debts',
                  ],
                },
              },
            },
            required: ['name', 'rfc', 'debts'],
          },
        },
      },
    })
    body: {
      name: string;
      rfc: string;
      debts: {
        id: number;
        total: number;
        month: number;
        year: number;
        honorary: number;
        debts: number;
      }[];
    },
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<Response> {
    const pdfBuffer = await this.pdfService.generateAccountStatement2(body);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="estado-de-deudas.pdf"',
    );
    res.end(pdfBuffer);

    return res;
  }
}
