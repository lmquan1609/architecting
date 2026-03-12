# Quick Start: Blue/Green Deployment

Instant rollback capability with zero downtime.

## Prerequisites
- VPC with 2+ subnets
- Application Load Balancer with 2 target groups (blue and green)
- Auto Scaling Group
- EFS file system

## Step 1: Create Target Groups

```bash
# Blue target group (current production)
aws elbv2 create-target-group \
  --name image-uploader-blue \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-xxxxxxxxx \
  --health-check-path /api/metadata \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region us-east-1

# Green target group (new deployment)
aws elbv2 create-target-group \
  --name image-uploader-green \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-xxxxxxxxx \
  --health-check-path /api/metadata \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region us-east-1
```

## Step 2: Configure ALB Listener

```bash
# Add listener rule for blue target group
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:loadbalancer/app/image-uploader-alb/xxx \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/image-uploader-blue/xxx \
  --region us-east-1
```

## Step 3: Create Blue/Green Deployment Group

```bash
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production-bluegreen \
  --deployment-config-name CodeDeployDefault.AllAtOnce \
  --auto-scaling-groups image-uploader-asg \
  --blue-green-deployment-configuration '{
    "terminateBlueInstancesOnDeploymentSuccess": {
      "action": "TERMINATE",
      "terminationWaitTimeInMinutes": 5
    },
    "deploymentReadyOption": {
      "actionOnTimeout": "CONTINUE_DEPLOYMENT"
    },
    "greenFleetProvisioningOption": {
      "action": "COPY_AUTO_SCALING_GROUP"
    }
  }' \
  --load-balancer-info '{
    "targetGroupPairInfoList": [{
      "targetGroups": [
        {"name": "image-uploader-blue"},
        {"name": "image-uploader-green"}
      ],
      "prodTrafficRoute": {
        "listenerArns": ["arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:listener/app/image-uploader-alb/xxx/yyy"]
      }
    }]
  }' \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployServiceRole \
  --region us-east-1
```

## Step 4: Add Manual Approval (Optional)

Update pipeline to include approval before traffic shift:

```json
{
  "name": "Approval",
  "actions": [{
    "name": "ManualApproval",
    "actionTypeId": {
      "category": "Approval",
      "owner": "AWS",
      "provider": "Manual",
      "version": "1"
    },
    "configuration": {
      "CustomData": "Review green environment before traffic shift",
      "NotificationArn": "arn:aws:sns:us-east-1:ACCOUNT_ID:deployment-approvals"
    }
  }]
}
```

## Step 5: Test Blue/Green Deployment

```bash
# Trigger deployment
git push origin lab15-cicd

# Monitor deployment
aws deploy get-deployment --deployment-id d-XXXXXXXXX --region us-east-1

# Check green environment before traffic shift
GREEN_TG=$(aws deploy get-deployment --deployment-id d-XXXXXXXXX \
  --query 'deploymentInfo.targetInstances.autoScalingGroups[0]' --output text)

# Get green instance IPs
aws ec2 describe-instances \
  --filters "Name=tag:aws:autoscaling:groupName,Values=$GREEN_TG" \
  --query 'Reservations[].Instances[].PrivateIpAddress' \
  --output text
```

## Instant Rollback

```bash
# Reroute traffic back to blue
aws deploy stop-deployment \
  --deployment-id d-XXXXXXXXX \
  --auto-rollback-enabled \
  --region us-east-1
```

See CICD-GUIDE.md for complete details.
