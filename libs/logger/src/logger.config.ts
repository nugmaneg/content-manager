import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

export const getLoggerConfig = (appName: string): WinstonModuleOptions => {
    return {
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.timestamp({ format: 'HH:mm:ss' }),
                    winston.format.ms(),
                    winston.format.colorize({ all: true }),
                    winston.format.printf((info) => {
                        const { timestamp, level, message, context, ms, ...meta } = info;
                        const ctx = context ? `\x1b[33m[${context}]\x1b[39m` : '';
                        return `${timestamp} ${level} ${ctx} ${message} \x1b[33m${ms}\x1b[39m${Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''
                            }`;
                    }),
                ),
            }),
            new winston.transports.DailyRotateFile({
                filename: `logs/${appName}-error-%DATE%.log`,
                level: 'error',
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '20m',
                maxFiles: '14d',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json(),
                ),
            }),
            new winston.transports.DailyRotateFile({
                filename: `logs/${appName}-combined-%DATE%.log`,
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '20m',
                maxFiles: '14d',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json(),
                ),
            }),
        ],
    };
};
