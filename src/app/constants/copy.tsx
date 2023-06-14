import React from 'react';
import { Trans } from 'react-i18next';

export const testTrans: React.ReactNode = (
    <div>
        <Trans i18nKey="key-Workspace/LaserStartJob-3axis_start_job_prompt">
            Under the Auto Mode, the machine will run auto focus according to the material thickness you input, and start the job.<br />
            Under the Manual Mode, the machine will use the current work origin to start the job. Make sure you’ve set the work origin before starting.<br />
            Safety Info: Before use, make sure the machine has been equipped with an enclosure, and both the operator and bystanders have worn Laser
            Safety Goggles.
        </Trans>
        <Trans i18nKey="key-Workspace/LaserStartJob-10w_3axis_start_job_prompt">
            Under the Auto Mode, the machine will run auto focus according to the material thickness you input, and start the job.<br />
            Under the Manual Mode, the machine will use the current work origin to start the job. Make sure you’ve set the work origin before starting.<br />
            Safety Info: Before use, make sure the machine has been equipped with an enclosure, and both the operator and bystanders have worn Laser
            Safety Goggles.
        </Trans>
        <Trans i18nKey="key-Workspace/LaserStartJob-4axis_start_job_prompt">
            The machine will use the current work origin to start the job. Make sure you’ve set the work origin before starting.<br />
            Safety Info: Before use, make sure the machine has been equipped with an enclosure, and both the operator and bystanders have worn Laser
            Safety Goggles.
        </Trans>
    </div>
);
