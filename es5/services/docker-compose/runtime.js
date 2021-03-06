'use strict';

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { AbstractService, Joi } = require('@kapitchi/bb-service');
const _ = require('lodash');
const shell = require('shelljs');
const { spawnSync } = require('child_process');

class DockerComposeRuntime extends AbstractService {
  constructor(docker) {
    super();

    //check if docker-compose is available on local system
    this.shell.exec('docker-compose --version', { silent: true });

    this.docker = docker;
  }

  run(params) {
    var _this = this;

    return (0, _asyncToGenerator3.default)(function* () {
      _this.params(params, {
        service: Joi.object(),
        op: Joi.string()
      });

      //we don't do `params = this.params(...)` as we want original reference of the service
      const { service, op } = params;

      const serviceName = service.dockerCompose.service;

      switch (op) {
        case 'install':
        case 'update':
        case 'reset':
          let cmd = 'run';
          if ((yield _this.getStatus(serviceName)) === 'running') {
            cmd = 'exec';
          }

          const args = [`--user ${_this.getUserGroup()}`];

          if (cmd === 'run') {
            args.push('--rm');
            //TODO escape val?
            _.each(service.env, function (val, key) {
              args.push(`-e ${key}=${val}`);
            });
          }

          _this.logger.log({
            level: 'info',
            msg: `${serviceName}: RUNNING 'docker-compose ${cmd} <args> ${serviceName} bb-box ${op}. The below runs on the container:`
          });

          _this.spawn('docker-compose', [cmd, ...args, serviceName, 'bb-box', op], {
            env: service.env
          });

          _this.logger.log({
            level: 'info',
            msg: `${serviceName}: END`
          });
          break;
        case 'start':
          _this.spawn('docker-compose', ['up', '-d', serviceName], {
            env: service.env
          });
          break;
        case 'stop':
          _this.spawn('docker-compose', ['stop', serviceName], {
            env: service.env
          });
          break;
        case 'status':
          service.status = yield _this.getStatus(serviceName);
          break;
        default:
          throw new Error('DockerComposePlugin: Not supported operation ' + op);
      }
    })();
  }

  getStatus(serviceName) {
    var _this2 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      const containers = yield _this2.docker.listContainers({
        all: 1
      });
      const container = _.find(containers, function (cnt) {
        return cnt.Labels['com.docker.compose.service'] === serviceName;
      });
      if (container) {
        return container.State;
      }
      return undefined;
    })();
  }

  getUserGroup() {
    return `${process.getuid()}:${process.getgid()}`;
  }

  spawn(cmd, args, opts) {
    //merge current process env with spawn cmd
    const env = _.defaults({
      BOX_USER: this.getUserGroup()
    }, opts.env, process.env);
    const ret = spawnSync(cmd, args, _.defaults({
      env,
      stdio: 'inherit',
      shell: true
    }, opts));
    if (ret.status !== 0) {
      console.error(ret); //XXX
      throw new Error('spawn error');
    }
  }

  get shell() {
    shell.config.reset();
    shell.config.silent = true;
    shell.config.fatal = true;

    return shell;
  }
}

module.exports = DockerComposeRuntime;
//# sourceMappingURL=runtime.js.map