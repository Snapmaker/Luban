import React from 'react';
import * as Paginations from '@trendmicro/react-paginations';
import '@trendmicro/react-paginations/dist/react-paginations.css';
import i18n from '../../../lib/i18n';

export const TablePagination = (props) => {
    return (
        <Paginations.TablePagination
            {...props}
            pageRecordsRenderer={({ totalRecords, from, to }) => {
                if (totalRecords > 0) {
                    return i18n._('key_ui/components/Paginations_Records: {{from}} - {{to}} / {{total}}', {
                        from,
                        to,
                        total: totalRecords
                    });
                }

                return i18n._('key_ui/components/Paginations_Records: {{total}}', { total: totalRecords });
            }}
            pageLengthRenderer={({ pageLength }) => (
                <span>
                    {i18n._('key_ui/components/Paginations_{{pageLength}} per page', { pageLength })}
                    <i className="caret" />
                </span>
            )}
        />
    );
};
