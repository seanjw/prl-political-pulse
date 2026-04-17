FROM public.ecr.aws/lambda/python:3.11

# Copy requirements and install dependencies (using pre-built wheels)
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --upgrade pip && pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Copy function code
COPY handler.py ${LAMBDA_TASK_ROOT}/
COPY processing/ ${LAMBDA_TASK_ROOT}/processing/
COPY config/ ${LAMBDA_TASK_ROOT}/config/

# Set the CMD to your handler
CMD [ "handler.lambda_handler" ]
